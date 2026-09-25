import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function cloudHarness(currentRevision = 0) {
  const writes = [];
  const api = {
    doc: (_db, ...parts) => ({ path: parts.join('/') }),
    serverTimestamp: () => 'SERVER_TIME',
    runTransaction: async (_db, callback) => callback({
      get: async () => ({ exists: () => currentRevision > 0, data: () => ({ revision: currentRevision }) }),
      set: (ref, data) => writes.push({ path: ref.path, data }),
    }),
  };
  const source = readFileSync(new URL('../app/cloud.mjs', import.meta.url), 'utf8')
    .replace(/^import .*\n/m, '')
    .replace(/^export \{.*\};\n/m, '')
    .replace(/^export /gm, '');
  const context = {
    firebaseConfig: { projectId: 'test', apiKey: 'test', authDomain: 'test' },
    providersReady: { google: true, facebook: false },
    crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' },
    location: { protocol: 'https:' },
  };
  runInNewContext(source + '\nglobalThis.cloudTest={save,listOperations,configure:(api)=>{auth={currentUser:{uid:"owner-1"}};db={};storeApi=api}};', context);
  context.cloudTest.configure(api);
  return { cloud: context.cloudTest, api, writes };
}

const plan = {
  mode: 'weekly', place: 'pocket', placeName: 'Nequi', purpose: 'Mi fondo de emergencia',
  startDate: '2026-09-25', entries: [],
};

test('a confirmed plan change and its audit operation are written atomically', async () => {
  const { cloud, writes } = cloudHarness();
  await cloud.save(plan, 0, { type: 'plan_created', amount: 0, ids: [], entryId: '' });
  assert.equal(writes.length, 2);
  assert.equal(writes[0].path, 'users/owner-1/plans/active');
  assert.equal(writes[0].data.revision, 1);
  assert.equal(writes[0].data.lastOperationId, '12345678-1234-1234-1234-123456789abc');
  assert.equal(writes[1].path, 'users/owner-1/operations/12345678-1234-1234-1234-123456789abc');
  assert.equal(writes[1].data.type, 'plan_created');
  assert.equal(writes[1].data.createdAt, 'SERVER_TIME');
});

test('a stale revision makes no plan or activity write', async () => {
  const { cloud, writes } = cloudHarness(2);
  await assert.rejects(() => cloud.save(plan, 1, { type: 'goal_updated' }), /otro dispositivo/);
  assert.equal(writes.length, 0);
});

test('activity pagination stays scoped to the authenticated user', async () => {
  const { cloud, api } = cloudHarness();
  let collectionPath;
  api.collection = (_db, ...parts) => { collectionPath = parts.join('/'); return collectionPath; };
  api.orderBy = (...args) => args;
  api.limit = count => count;
  api.query = (...args) => args;
  api.getDocs = async () => ({ docs: [{ id: 'op-1', data: () => ({ type: 'plan_created', createdAt: { toDate: () => new Date('2026-09-25T12:00:00Z') } }) }] });
  const result = await cloud.listOperations(null, 25);
  assert.equal(collectionPath, 'users/owner-1/operations');
  assert.equal(result.items[0].createdAt, '2026-09-25T12:00:00.000Z');
  assert.equal(result.hasMore, false);
});
