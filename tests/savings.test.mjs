import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlan, summarize, SHORTCUTS, shortcutQuote } from '../src/savings.mjs';

test('Original schedules reconcile with supplied references', () => {
  for (const [mode, count, total] of [['weekly', 26, 1001000], ['daily', 40, 1020000], ['flexible', 200, 1195000]]) {
    const plan = createPlan(mode);
    assert.equal(plan.length, count);
    assert.equal(new Set(plan.map(item => item.id)).size, count);
    const completed = summarize(mode, plan.map(item => item.id));
    assert.equal(completed.saved, total);
    assert.equal(completed.remaining, 0);
    assert.equal(completed.progress, 100);
    assert.equal(completed.planCompleted, true);
  }
});

test('New user starts at zero; repeated contribution IDs never double count', () => {
  assert.equal(summarize('weekly').saved, 0);
  assert.equal(summarize('weekly', ['weekly-1', 'weekly-1']).saved, 26000);
  assert.equal(summarize('weekly', createPlan('weekly').slice(0, 6).map(item => item.id)).saved, 171000);
});

test('Unknown methods and contributions fail explicitly', () => {
  assert.throws(() => createPlan('other'));
  assert.throws(() => summarize('weekly', ['daily-1']));
});

test('Goal and completion are separate milestones', () => {
  const plan = createPlan('flexible');
  const almostAll = summarize('flexible', plan.slice(1).map(item => item.id));
  assert.equal(almostAll.goalReached, true);
  assert.equal(almostAll.planCompleted, false);
});

test('All five shortcuts reconcile exactly, with no overlapping cells',()=>{
  const ids=[];
  for(const group of SHORTCUTS){const quote=shortcutQuote(group.key);assert.equal(quote.amount,group.suggested);ids.push(...quote.ids);}
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(summarize('flexible',ids).saved,300000);
});
test('A partially paid shortcut charges only pending cells and cannot be repeated',()=>{
  const full=shortcutQuote('smile');
  const first=createPlan('flexible').find(x=>x.id===full.ids[0]);
  const rest=shortcutQuote('smile',[first.id]);
  assert.equal(rest.amount,20000-first.amount);
  assert.equal(rest.ids.includes(first.id),false);
  assert.deepEqual(shortcutQuote('smile',full.ids).ids,[]);
  assert.equal(shortcutQuote('smile',full.ids).amount,0);
  assert.throws(()=>shortcutQuote('invalid'));
});
