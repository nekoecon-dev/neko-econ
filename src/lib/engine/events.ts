import type { GameState } from '@/types/game';

const COOLDOWN_TICKS = 25;

// Last tick at which each event fired, to prevent repeated firing.
const lastFired: Record<string, number> = {};

interface EventRule {
  name: string;
  test: (state: GameState) => boolean;
}

const RULES: EventRule[] = [
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

/**
 * Return the first triggered event name, or null. Each event has a cooldown so
 * the same event cannot fire again within COOLDOWN_TICKS. The cooldown state is
 * module-level by design (a single game runs per page).
 */
export function detectEvent(state: GameState): string | null {
  for (const rule of RULES) {
    if (!rule.test(state)) continue;
    const previous = lastFired[rule.name];
    if (previous !== undefined && state.tick - previous < COOLDOWN_TICKS) continue;
    lastFired[rule.name] = state.tick;
    return rule.name;
  }
  return null;
}

/** Test helper: clear cooldown state. */
export function resetEventCooldowns(): void {
  for (const key of Object.keys(lastFired)) delete lastFired[key];
}
