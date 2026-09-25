// Original contribution schedules, pending confirmation of final product rules.
export const GOAL_COP = 1_000_000;

// User-approved exact-total icon groups; original contribution amounts unchanged.
export const SHORTCUTS = [
  {
    "key": "smile",
    "icon": "☺",
    "name": "Sonrisas",
    "suggested": 20000,
    "ids": [
      "flexible-1",
      "flexible-5",
      "flexible-45",
      "flexible-51",
      "flexible-54",
      "flexible-63"
    ]
  },
  {
    "key": "heart",
    "icon": "♥",
    "name": "Corazones",
    "suggested": 40000,
    "ids": [
      "flexible-3",
      "flexible-22",
      "flexible-24",
      "flexible-41",
      "flexible-43",
      "flexible-82",
      "flexible-123",
      "flexible-142",
      "flexible-161",
      "flexible-184",
      "flexible-4",
      "flexible-7"
    ]
  },
  {
    "key": "music",
    "icon": "♫",
    "name": "Notas",
    "suggested": 60000,
    "ids": [
      "flexible-26",
      "flexible-47",
      "flexible-67",
      "flexible-86",
      "flexible-104",
      "flexible-146",
      "flexible-181",
      "flexible-193",
      "flexible-197",
      "flexible-2",
      "flexible-6"
    ]
  },
  {
    "key": "sun",
    "icon": "☀",
    "name": "Soles",
    "suggested": 80000,
    "ids": [
      "flexible-23",
      "flexible-28",
      "flexible-66",
      "flexible-69",
      "flexible-106",
      "flexible-107",
      "flexible-149",
      "flexible-164",
      "flexible-167",
      "flexible-188",
      "flexible-8"
    ]
  },
  {
    "key": "triangle",
    "icon": "▲",
    "name": "Triángulos",
    "suggested": 100000,
    "ids": [
      "flexible-25",
      "flexible-42",
      "flexible-49",
      "flexible-70",
      "flexible-88",
      "flexible-105",
      "flexible-128",
      "flexible-130",
      "flexible-143",
      "flexible-145",
      "flexible-169",
      "flexible-190",
      "flexible-10"
    ]
  }
];

export function shortcutQuote(key, completedIds=[]) {
  const group=SHORTCUTS.find(item=>item.key===key);
  if(!group)throw new Error('Atajo desconocido.');
  const completed=new Set(completedIds);
  const items=createPlan('flexible').filter(item=>group.ids.includes(item.id)&&!completed.has(item.id));
  return { key, ids:items.map(item=>item.id), amount:items.reduce((sum,item)=>sum+item.amount,0) };
}

export function createPlan(mode) {
  if (mode === 'weekly') return Array.from({ length: 26 }, (_, i) => ({ id: `weekly-${i + 1}`, amount: 26_000 + i * 1_000, period: i + 1 }));
  if (mode === 'daily') return Array.from({ length: 40 }, (_, i) => ({ id: `daily-${i + 1}`, amount: 6_000 + i * 1_000, period: i + 1 }));
  if (mode === 'flexible') return Array.from({ length: 200 }, (_, i) => ({ id: `flexible-${i + 1}`, amount: (i % 10 + 1) * 1_000 + Math.floor(i / 10) * 50, shortcut:SHORTCUTS.find(group=>group.ids.includes(`flexible-${i+1}`))?.key||null }));
  throw new Error('Método de ahorro desconocido.');
}

export function summarize(mode, completedIds = []) {
  const plan = createPlan(mode);
  const ids = new Set(completedIds);
  const validIds = new Set(plan.map(item => item.id));
  if ([...ids].some(id => !validIds.has(id))) throw new Error('El aporte no pertenece a este plan.');
  const saved = plan.reduce((sum, item) => sum + (ids.has(item.id) ? item.amount : 0), 0);
  return {
    saved,
    remaining: Math.max(0, GOAL_COP - saved),
    progress: Math.min(100, saved / GOAL_COP * 100),
    goalReached: saved >= GOAL_COP,
    planCompleted: ids.size === plan.length,
    planTotal: plan.reduce((sum, item) => sum + item.amount, 0),
    completedCount: ids.size,
  };
}
