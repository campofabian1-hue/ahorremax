import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDreamPlan, contributionDate, forecastDream } from '../src/dream.mjs';

test('a deadline produces an exact goal and a smaller final installment when needed', () => {
  const quote = calculateDreamPlan({ goal: 1_000_000, startDate: '2026-10-15', targetDate: '2027-01-15', cadence: 'monthly', strategy: 'deadline' });
  assert.deepEqual(quote, { contribution: 250_000, periods: 4, projectedDate: '2027-01-15', lastAmount: 250_000 });
  const uneven = calculateDreamPlan({ goal: 1_000_000, startDate: '2026-10-15', targetDate: '2026-12-15', cadence: 'monthly', strategy: 'deadline' });
  assert.deepEqual(uneven, { contribution: 333_334, periods: 3, projectedDate: '2026-12-15', lastAmount: 333_332 });
});

test('a chosen installment projects the real finishing date for each cadence', () => {
  assert.equal(calculateDreamPlan({ goal: 1_000_000, startDate: '2026-10-15', cadence: 'weekly', strategy: 'amount', amount: 100_000 }).projectedDate, '2026-12-17');
  assert.equal(contributionDate('2026-01-31', 'monthly', 1), '2026-02-28');
  assert.equal(contributionDate('2026-01-31', 'monthly', 2), '2026-03-31');
  assert.equal(contributionDate('2026-10-15', 'fortnightly', 2), '2026-11-14');
});

test('the forecast uses remaining money and never counts a contribution twice', () => {
  const estimate = forecastDream({ goal: 1_000_000, saved: 450_000, contribution: 200_000, startDate: '2026-10-15', cadence: 'monthly', completedCount: 2, referenceDate: '2026-11-01' });
  assert.deepEqual(estimate, { remaining: 550_000, periods: 3, nextDate: '2026-12-15', projectedDate: '2027-02-15', nextAmount: 200_000 });
  assert.equal(forecastDream({ goal: 1_000_000, saved: 1_000_000, contribution: 200_000, startDate: '2026-10-15', cadence: 'monthly', referenceDate: '2026-11-01' }).periods, 0);
});

test('invalid dates and unworkable horizons are rejected', () => {
  assert.throws(() => calculateDreamPlan({ goal: 100_000, startDate: '2026-02-30', targetDate: '2026-03-30', cadence: 'daily', strategy: 'deadline' }), /fecha válida/);
  assert.throws(() => calculateDreamPlan({ goal: 100_000, startDate: '2026-10-15', targetDate: '2026-10-14', cadence: 'daily', strategy: 'deadline' }), /posterior/);
  assert.throws(() => calculateDreamPlan({ goal: 100_000, startDate: '2026-10-15', cadence: 'monthly', strategy: 'amount', amount: 1 }), /demasiados registros/);
});
