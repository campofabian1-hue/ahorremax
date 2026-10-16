const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pendingDreamAmount } = require('../functions/reminder-logic.cjs');

const plan = { mode:'dream', goal:10000, saved:0, contribution:1000, periods:10, cadence:'daily', startDate:'2026-10-01' };
test('scheduled push is due the day after a missed contribution', () => {
  assert.equal(pendingDreamAmount(plan,'2026-10-01'),0);
  assert.equal(pendingDreamAmount(plan,'2026-10-02'),1000);
  assert.equal(pendingDreamAmount({ ...plan, saved:1000 },'2026-10-02'),0);
});
test('extra savings cover upcoming scheduled contributions', () => {
  assert.equal(pendingDreamAmount({ ...plan, saved:3000 },'2026-10-03'),0);
  assert.equal(pendingDreamAmount({ ...plan, saved:3000 },'2026-10-05'),1000);
});
