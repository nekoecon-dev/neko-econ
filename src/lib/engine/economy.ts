import type { Cat, Economy, GameState, VillageMood, Weather, WeatherState } from '@/types/game';
import { clamp, round2 } from './math';
import { FACTORY_UNEMPLOYMENT_RELIEF } from './facilities';

// Minimum wall-clock hold for dramatic weather (30 seconds).
export const WEATHER_LOCK_MS = 30_000;

const PRICE_MIN = 1;
const PRICE_MAX = 9999;

/**
 * Update the soup price from the supply/demand balance.
 * The price drifts toward the demand/supply ratio; the per-tick change is
 * clamped to [-40%, +40%] (wide enough that a demand shock — e.g. mass currency
 * issuance — can push inflation past +30% into hyperinflation), and the price
 * to [1, 9999]. Demand has built-in negative feedback so the price still
 * mean-reverts and stays bounded.
 */
export function updatePrice(
  currentPrice: number,
  supply: number,
  demand: number,
): number {
  const safeSupply = Math.max(supply, 0.1);
  const ratio = demand / safeSupply;
  // ratio > 1 -> shortage -> price up; ratio < 1 -> glut -> price down.
  const rawChange = 0.15 * (ratio - 1);
  const change = clamp(rawChange, -0.4, 0.4);
  const next = currentPrice * (1 + change);
  return round2(clamp(next, PRICE_MIN, PRICE_MAX));
}

/** Inflation rate (%) of the current price relative to the previous tick. */
export function calcInflationRate(
  currentPrice: number,
  previousPrice: number,
): number {
  if (previousPrice <= 0) return 0;
  return round2(((currentPrice - previousPrice) / previousPrice) * 100);
}

/** Unemployment rate (%) = share of cats whose action is 'idle'. */
export function calcUnemploymentRate(cats: Cat[]): number {
  if (cats.length === 0) return 0;
  const idle = cats.filter((c) => c.action === 'idle').length;
  return round2((idle / cats.length) * 100);
}

/**
 * Gini coefficient over money (0 = perfect equality, 1 = maximal inequality).
 * Uses the sorted-rank formula: G = (2·Σ i·x_i)/(n·Σ x_i) − (n+1)/n.
 */
export function calcGini(cats: Cat[]): number {
  const n = cats.length;
  if (n === 0) return 0;
  const values = cats.map((c) => Math.max(0, c.money)).sort((a, b) => a - b);
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) {
    weighted += (i + 1) * values[i];
  }
  const gini = (2 * weighted) / (n * total) - (n + 1) / n;
  return round2(clamp(gini, 0, 1));
}

/**
 * Classify the overall economic mood from inflation + unemployment.
 * Used to subtly tint the village background (boom = bright, recession = dark).
 */
export function getVillageMood(economy: Economy): VillageMood {
  const { inflationRate, unemploymentRate } = economy;
  if (unemploymentRate > 40 || inflationRate > 20 || inflationRate < -15) {
    return 'recession';
  }
  if (unemploymentRate < 20 && inflationRate >= 0 && inflationRate <= 10) {
    return 'boom';
  }
  return 'normal';
}

/**
 * Map the economy to a dramatic weather/atmosphere state for the map.
 * Priority: hyperinflation > depression > boom > normal.
 * - hyperinflation: smoothed inflation > +30%
 * - depression: unemployment > 80%
 * - boom: smoothed inflation between +2% and +5%
 *
 * Inflation is smoothed over the last few ticks so a single transient price
 * spike (e.g. a momentary supply gap) doesn't flip the whole village to red;
 * only a *sustained* surge (e.g. mass currency issuance) counts.
 */
export function getWeather(economy: Economy): Weather {
  const recent = economy.inflationHistory.slice(-5);
  const smoothedInflation =
    recent.length > 0
      ? recent.reduce((sum, v) => sum + v, 0) / recent.length
      : economy.inflationRate;

  if (smoothedInflation > 30) return 'hyperinflation';
  if (economy.unemploymentRate > 80) return 'depression';
  if (smoothedInflation >= 2 && smoothedInflation <= 5) return 'boom';
  return 'normal';
}

/** Dramatic weather that must hold for a minimum duration once triggered. */
function isLockable(weather: Weather): boolean {
  return weather === 'hyperinflation' || weather === 'depression';
}

/**
 * Advance the weather state, enforcing a minimum-duration lock so a
 * hyperinflation/depression doesn't vanish the instant its trigger eases.
 * The lock is wall-clock based (Date.now() ms) so it holds for a real 30s
 * regardless of tick speed.
 */
export function nextWeatherState(economy: Economy, prev: WeatherState): WeatherState {
  const now = Date.now();
  // Hold a locked dramatic weather until its lock expires.
  if (isLockable(prev.current) && now < prev.lockUntil) {
    return prev;
  }
  const raw = getWeather(economy);
  return {
    current: raw,
    lockUntil: isLockable(raw) ? now + WEATHER_LOCK_MS : 0,
  };
}

/**
 * Recompute the whole Economy snapshot for the current tick: new soup price,
 * inflation, unemployment, gini, total money, and the rolling inflation chart.
 * Call this each tick AFTER updateAllCats (which sets market.supply/demand).
 */
export function updateEconomy(
  state: GameState,
  opts: { freezePrice?: boolean } = {},
): GameState {
  const { market, cats } = state;
  const previousPrice = market.soupPrice;
  // During a strike the market is frozen: price holds, inflation is zero.
  const newPrice = opts.freezePrice
    ? previousPrice
    : updatePrice(previousPrice, market.supply, market.demand);
  const inflationRate = opts.freezePrice ? 0 : calcInflationRate(newPrice, previousPrice);
  // Soup factories provide jobs, shaving points off the unemployment rate.
  const unemploymentRate = clamp(
    calcUnemploymentRate(cats) - FACTORY_UNEMPLOYMENT_RELIEF * state.facilities.soupFactory,
    0,
    100,
  );
  const gini = calcGini(cats);
  const totalMoney = round2(cats.reduce((sum, c) => sum + c.money, 0));
  const inflationHistory = [...state.economy.inflationHistory, inflationRate].slice(-20);

  return {
    ...state,
    market: { ...market, soupPrice: newPrice },
    economy: {
      soupPrice: newPrice,
      inflationRate,
      unemploymentRate,
      gini,
      totalMoney,
      inflationHistory,
    },
  };
}
