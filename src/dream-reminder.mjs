import { contributionDate, forecastDream } from './dream.mjs';

// A missed scheduled amount changes the projection, never the amount already saved.
export function dreamReminder(plan, referenceDate) {
  if (!plan || plan.saved >= plan.goal || referenceDate <= plan.startDate) return null;
  let dueCount = 0;
  while (dueCount < plan.periods && contributionDate(plan.startDate, plan.cadence, dueCount) < referenceDate) dueCount++;
  if (!dueCount) return null;
  const scheduled = Math.min(plan.goal, dueCount * plan.contribution);
  const shortfall = Math.max(0, scheduled - plan.saved);
  if (!shortfall) return null;
  const forecast = forecastDream({ ...plan, completedCount: plan.entries?.length || 0, referenceDate });
  return {
    shortfall,
    dueCount,
    nextDate: forecast.nextDate,
    projectedDate: forecast.projectedDate,
    delayed: forecast.projectedDate > plan.projectedDate,
  };
}
