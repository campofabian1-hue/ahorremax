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
    webPushVapidKey: '',
    crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' },
    location: { protocol: 'https:' },
  };
  runInNewContext(source + '\nglobalThis.cloudTest={save,saveDream,saveDreamPhoto,watchPlans,watchDream,listOperations,listDreamOperations,configure:(api)=>{auth={currentUser:{uid:"owner-1"}};db={};storeApi=api}};', context);
  context.cloudTest.configure(api);
  return { cloud: context.cloudTest, api, writes };
}

const plan = {
  mode: 'weekly', place: 'pocket', placeName: 'Nequi', purpose: 'Mi fondo de emergencia',
  startDate: '2026-09-25', entries: [],
};

test('a confirmed plan change and its audit operation are written atomically', async () => {
  const { cloud, writes } = cloudHarness();
  await cloud.save(plan, 0, { type: 'plan_created', amount: 0, ids: [], entryId: '' }, 'active');
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

test('each new method writes its own plan without changing the legacy plan', async () => {
  const { cloud, writes } = cloudHarness();
  await cloud.save({ ...plan, mode: 'daily' }, 0,
    { type: 'plan_created', amount: 0, ids: [], entryId: '' }, 'daily');
  assert.equal(writes[0].path, 'users/owner-1/plans/daily');
  assert.equal(writes[1].data.mode, 'daily');
  await assert.rejects(() => cloud.save(plan, 0, { type: 'plan_created' }, 'daily'), /no coincide/);
});

test('the personal dream writes its plan and audit record separately from fixed challenges', async () => {
  const { cloud, writes } = cloudHarness();
  await cloud.saveDream({
    mode: 'dream', purpose: 'Mi viaje', goal: 1200000, cadence: 'monthly',
    strategy: 'amount', startDate: '2026-10-15', targetDate: '',
    contribution: 100000, periods: 12, projectedDate: '2027-09-15',
    place: 'pocket', placeName: 'Nequi', saved: 0, entries: [],
  }, 0, { type: 'dream_created', amount: 0, entryId: '' });
  assert.equal(writes.length, 2);
  assert.equal(writes[0].path, 'users/owner-1/plans/dream');
  assert.equal(writes[1].path, 'users/owner-1/dreamOperations/12345678-1234-1234-1234-123456789abc');
  assert.equal(writes[1].data.type, 'dream_created');
});

test('a dream photo and its private audit event are written together', async () => {
  const { cloud, writes } = cloudHarness();
  const image = 'data:image/jpeg;base64,aGVsbG8=';
  await cloud.saveDreamPhoto(image, 0);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].path, 'users/owner-1/dreamMedia/cover');
  assert.equal(writes[0].data.imageData, image);
  assert.equal(writes[1].path, 'users/owner-1/dreamMediaOperations/12345678-1234-1234-1234-123456789abc');
  assert.equal(writes[1].data.type, 'photo_added');
});

test('a stale dream photo revision cannot overwrite another device', async () => {
  const { cloud, writes } = cloudHarness(2);
  await assert.rejects(() => cloud.saveDreamPhoto('data:image/jpeg;base64,aGVsbG8=', 1), /otro dispositivo/);
  assert.equal(writes.length, 0);
});

test('existing active plan and named plans are combined per method', () => {
  const { cloud, api } = cloudHarness();
  const listeners = new Map();
  api.onSnapshot = (ref, _options, onData) => { listeners.set(ref.path, onData); return () => listeners.delete(ref.path); };
  const updates = [];
  const stop = cloud.watchPlans(plans => updates.push(plans), error => { throw error; });
  const emit = (id, data) => listeners.get(`users/owner-1/plans/${id}`)({
    metadata: { hasPendingWrites: false }, exists: () => Boolean(data), data: () => data,
  });
  emit('weekly', { ...plan, mode: 'weekly', revision: 1 });
  emit('daily', null);
  emit('flexible', null);
  assert.equal(updates.length, 0);
  emit('active', { ...plan, mode: 'flexible', revision: 4 });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].flexible.planId, 'active');
  assert.equal(updates[0].flexible.revision, 4);
  assert.equal(updates[0].weekly.planId, 'weekly');
  assert.equal(updates[0].daily, null);
  emit('daily', { ...plan, mode: 'daily', revision: 1 });
  assert.equal(updates[1].daily.planId, 'daily');
  stop();
  assert.equal(listeners.size, 0);
});

test('activity pagination stays scoped to the authenticated user', async () => {
  const { cloud, api } = cloudHarness();
  let collectionPath;
  api.collection = (_db, ...parts) => { collectionPath = parts.join('/'); return collectionPath; };
  api.orderBy = (...args) => { assert.equal(args[0], 'createdAt'); return args; };
  api.limit = count => count;
  api.query = (...args) => args;
  api.getDocs = async () => ({ docs: [{ id: 'op-1', data: () => ({ type: 'plan_created', createdAt: { toDate: () => new Date('2026-09-25T12:00:00Z') } }) }] });
  const result = await cloud.listOperations(null, 25);
  assert.equal(collectionPath, 'users/owner-1/operations');
  assert.equal(result.items[0].createdAt, '2026-09-25T12:00:00.000Z');
  assert.equal(result.hasMore, false);
});
