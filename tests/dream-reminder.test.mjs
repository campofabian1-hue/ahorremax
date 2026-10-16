import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { calculateDreamPlan } from '../src/dream.mjs';
import { dreamReminder } from '../src/dream-reminder.mjs';

function plan(cadence = 'daily') {
  return { ...calculateDreamPlan({ goal: 10000, startDate: '2026-10-01', cadence, strategy: 'amount', amount: 1000 }), goal: 10000, startDate: '2026-10-01', cadence, saved: 0, entries: [] };
}

test('no alerta antes o en la fecha del primer aporte', () => {
  assert.equal(dreamReminder(plan(), '2026-10-01'), null);
});
test('avisa al día siguiente por el aporte no registrado', () => {
  const alert = dreamReminder(plan(), '2026-10-02');
  assert.equal(alert.shortfall, 1000);
  assert.equal(alert.delayed, true);
  assert.equal(alert.projectedDate, '2026-10-11');
});
test('ahorro adicional adelantado cubre aportes previstos y evita alerta', () => {
  assert.equal(dreamReminder({ ...plan(), saved: 3000, entries: [{ amount: 3000 }] }, '2026-10-03'), null);
});
test('frecuencia mensual respeta calendario', () => {
  assert.equal(dreamReminder(plan('monthly'), '2026-10-31').shortfall, 1000);
  assert.equal(dreamReminder(plan('monthly'), '2026-11-02').shortfall, 2000);
});
