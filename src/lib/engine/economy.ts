import type { Cat, GameState } from '@/types/game';
import { clamp, round2 } from './math';

const PRICE_MIN = 1;
const PRICE_MAX = 9999;

/**
 * Update the soup price from the supply/demand balance.
 * The price drifts toward the demand/supply ratio; the per-tick change is
 * clamped to [-20%, +20%] for smooth animation, and the price to [1, 9999].
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
  const change = clamp(rawChange, -0.12, 0.12);
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
 * Recompute the whole Economy snapshot for the current tick: new soup price,
 * inflation, unemployment, gini, total money, and the rolling inflation chart.
 * Call this each tick AFTER updateAllCats (which sets market.supply/demand).
 */
export function updateEconomy(state: GameState): GameState {
  const { market, cats } = state;
  const previousPrice = market.soupPrice;
  const newPrice = updatePrice(previousPrice, market.supply, market.demand);
  const inflationRate = calcInflationRate(newPrice, previousPrice);
  const unemploymentRate = calcUnemploymentRate(cats);
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
