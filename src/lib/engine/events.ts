import type { DetectedEvent, GameState } from '@/types/game';

const COOLDOWN_TICKS = 25;

// Last tick at which each event fired, keyed by name (+catId for cat events).
const lastFired: Record<string, number> = {};

interface EconomyRule {
  name: string;
  test: (state: GameState) => boolean;
}

const ECONOMY_RULES: EconomyRule[] = [
  { name: 'ハイパーインフレ', test: (s) => s.economy.inflationRate > 20 },
  { name: 'デフレ不況', test: (s) => s.economy.inflationRate < -15 },
  { name: '食料危機', test: (s) => s.economy.soupPrice > 30 },
  { name: '大量失業', test: (s) => s.economy.unemploymentRate > 40 },
  { name: '格差社会', test: (s) => s.economy.gini > 0.6 },
  {
    name: '好景気',
    test: (s) =>
      s.economy.inflationRate >= 2 &&
      s.economy.inflationRate <= 8 &&
      s.economy.unemploymentRate < 20,
  },
];

/** Cat-specific events (drive both the news ticker and that cat's stock). */
function findCatEvents(state: GameState): DetectedEvent[] {
  const results: DetectedEvent[] = [];

  // 破産: a cat that has run out of money.
  const broke = state.cats.find((c) => c.money <= 0);
  if (broke) results.push({ name: '破産', catId: broke.id, catName: broke.name });

  // 大儲け: the richest cat, when notably wealthier than the village average.
  const total = state.cats.reduce((sum, c) => sum + c.money, 0);
  const avg = total / Math.max(state.cats.length, 1);
  const richest = [...state.cats].sort((a, b) => b.money - a.money)[0];
  if (richest && avg > 0 && richest.money >= Math.max(30, avg * 1.6)) {
    results.push({ name: '大儲け', catId: richest.id, catName: richest.name });
  }

  return results;
}

/**
 * Return the first triggered event (or null), respecting a per-event cooldown.
 * Cat events are prioritised over economy-wide events. Cooldown state is
 * module-level by design (a single game runs per page).
 */
export function detectEvent(state: GameState): DetectedEvent | null {
  const candidates: DetectedEvent[] = [
    ...findCatEvents(state),
    ...ECONOMY_RULES.filter((r) => r.test(state)).map((r) => ({ name: r.name })),
  ];

  for (const ev of candidates) {
    const key = ev.catId ? `${ev.name}:${ev.catId}` : ev.name;
    const previous = lastFired[key];
    if (previous !== undefined && state.tick - previous < COOLDOWN_TICKS) continue;
    lastFired[key] = state.tick;
    return ev;
  }
  return null;
}

/** Test helper: clear cooldown state. */
export function resetEventCooldowns(): void {
  for (const key of Object.keys(lastFired)) delete lastFired[key];
}
