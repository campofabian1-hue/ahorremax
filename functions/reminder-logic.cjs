const DAY = 86_400_000;

function contributionDate(startDate, cadence, index) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  if (cadence === 'monthly') {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
    month.setUTCDate(Math.min(start.getUTCDate(), last));
    return month.toISOString().slice(0, 10);
  }
  return new Date(start.getTime() + index * (cadence === 'weekly' ? 7 : cadence === 'fortnightly' ? 15 : 1) * DAY).toISOString().slice(0, 10);
}

function pendingDreamAmount(plan, date) {
  if (!plan || plan.mode !== 'dream' || !Number.isSafeInteger(plan.goal) || !Number.isSafeInteger(plan.saved)
    || plan.saved >= plan.goal || !Number.isSafeInteger(plan.contribution) || plan.contribution < 1
    || !Number.isSafeInteger(plan.periods) || plan.periods < 1 || plan.periods > 3700
    || !['daily', 'weekly', 'fortnightly', 'monthly'].includes(plan.cadence)
    || !/^\d{4}-\d{2}-\d{2}$/.test(plan.startDate) || date <= plan.startDate) return 0;
  let dueCount = 0;
  while (dueCount < plan.periods && contributionDate(plan.startDate, plan.cadence, dueCount) < date) dueCount++;
  return Math.max(0, Math.min(plan.goal, dueCount * plan.contribution) - plan.saved);
}

module.exports = { contributionDate, pendingDreamAmount };
