export const DREAM_CADENCES = {
  daily: { label: 'Diario', interval: 'cada día' },
  weekly: { label: 'Semanal', interval: 'cada 7 días' },
  fortnightly: { label: 'Quincenal', interval: 'cada 15 días' },
  monthly: { label: 'Mensual', interval: 'cada mes' },
};

const DAY = 86_400_000;
const MAX_PERIODS = 3_700;
const MAX_HORIZON_YEARS = 10;

function dateFromISO(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Escribe una fecha válida.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Escribe una fecha válida.');
  return date;
}

function asISO(date) { return date.toISOString().slice(0, 10); }

export function contributionDate(startDate, cadence, index) {
  const start = dateFromISO(startDate);
  if (!Object.hasOwn(DREAM_CADENCES, cadence) || !Number.isSafeInteger(index) || index < 0 || index > MAX_PERIODS) throw new Error('Revisa la frecuencia del ahorro.');
  if (cadence === 'monthly') {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const finalDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
    month.setUTCDate(Math.min(start.getUTCDate(), finalDay));
    return asISO(month);
  }
  const days = index * (cadence === 'weekly' ? 7 : cadence === 'fortnightly' ? 15 : 1);
  return asISO(new Date(start.getTime() + days * DAY));
}

export function calculateDreamPlan({ goal, startDate, cadence, strategy, targetDate = '', amount = 0 }) {
  if (!Number.isSafeInteger(goal) || goal < 1_000 || goal > 1_000_000_000) throw new Error('La meta debe estar entre $1.000 y $1.000.000.000.');
  if (!Object.hasOwn(DREAM_CADENCES, cadence)) throw new Error('Elige una frecuencia de ahorro.');
  dateFromISO(startDate);
  if (!['deadline', 'amount'].includes(strategy)) throw new Error('Elige cómo quieres calcular tu plan.');
  let periods;
  let contribution;
  if (strategy === 'deadline') {
    const end = dateFromISO(targetDate);
    if (end < dateFromISO(startDate)) throw new Error('La fecha de la meta debe ser posterior al primer aporte.');
    const max = new Date(`${startDate}T00:00:00.000Z`);
    max.setUTCFullYear(max.getUTCFullYear() + MAX_HORIZON_YEARS);
    if (end > max) throw new Error('Elige una fecha dentro de los próximos 10 años.');
    periods = 0;
    while (periods < MAX_PERIODS && contributionDate(startDate, cadence, periods) <= targetDate) periods++;
    if (periods === MAX_PERIODS) throw new Error('El plan necesita demasiados aportes. Elige otra frecuencia.');
    contribution = Math.ceil(goal / periods);
  } else {
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > goal) throw new Error('El aporte debe ser mayor que $0 y no superar la meta.');
    contribution = amount;
    periods = Math.ceil(goal / contribution);
    if (periods > MAX_PERIODS) throw new Error('Con ese aporte el plan tendría demasiados registros. Aumenta el monto o cambia la frecuencia.');
  }
  const projectedDate = contributionDate(startDate, cadence, periods - 1);
  const max = new Date(`${startDate}T00:00:00.000Z`);
  max.setUTCFullYear(max.getUTCFullYear() + MAX_HORIZON_YEARS);
  if (dateFromISO(projectedDate) > max) throw new Error('Con ese aporte tardarías más de 10 años. Ajusta el monto o la frecuencia.');
  return { contribution, periods, projectedDate, lastAmount: goal - contribution * (periods - 1) };
}

export function forecastDream({ goal, saved, contribution, startDate, cadence, completedCount = 0, referenceDate }) {
  if (!Number.isSafeInteger(saved) || saved < 0 || saved > goal) throw new Error('El ahorro registrado no coincide con la meta.');
  const remaining = goal - saved;
  if (!remaining) return { remaining: 0, periods: 0, nextDate: null, projectedDate: null, nextAmount: 0 };
  dateFromISO(referenceDate);
  let index = Math.max(0, completedCount);
  while (index < MAX_PERIODS && contributionDate(startDate, cadence, index) < referenceDate) index++;
  const periods = Math.ceil(remaining / contribution);
  if (index + periods > MAX_PERIODS) throw new Error('Este plan excede el plazo máximo de seguimiento.');
  return {
    remaining,
    periods,
    nextDate: contributionDate(startDate, cadence, index),
    projectedDate: contributionDate(startDate, cadence, index + periods - 1),
    nextAmount: Math.min(remaining, contribution),
  };
}
