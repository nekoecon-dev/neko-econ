import type { GameState, StockShare } from '@/types/game';
import { clamp, round2 } from './math';
import { STRIKE_STOCK_DECAY } from './strike';

// Defensive price bounds — stock prices can never escape this range.
export const STOCK_MIN = 10;
export const STOCK_MAX = 9999;
export const STOCK_BASE = 100; // 基準値 / initial price

// News-driven temporary shocks (multipliers that decay back toward 1).
export const SHOCK_RICH = 1.2; // 大儲け: +20%
export const SHOCK_BANKRUPT = 0.7; // 破産: -30%
const SHOCK_DECAY = 0.1; // per tick, toward 1
const BASE_SMOOTH = 0.3; // how fast `base` tracks the cat's money level

/** Build the initial stock for a cat (called from initialState). */
export function initStock(money: number): StockShare {
  return {
    price: STOCK_BASE,
    prevPrice: STOCK_BASE,
    base: clamp(money, STOCK_MIN, STOCK_MAX),
    shock: 1,
  };
}

/**
 * Recompute every cat's stock once per tick:
 * - the fundamental `base` smoothly tracks the cat's current money level
 *   (so the price reflects 所持金 without compounding/ratcheting),
 * - the temporary news `shock` decays toward 1,
 * - the displayed `price = base * shock`, all clamped to [STOCK_MIN, STOCK_MAX].
 */
export function updateStocks(
  state: GameState,
  opts: { onStrike?: boolean } = {},
): GameState {
  const stocks: Record<string, StockShare> = {};
  for (const cat of state.cats) {
    const prev = state.stocks[cat.id] ?? initStock(cat.money);
    let base = clamp(prev.base + (cat.money - prev.base) * BASE_SMOOTH, STOCK_MIN, STOCK_MAX);
    // During a strike every stock bleeds -1%/tick.
    if (opts.onStrike) base = clamp(base * STRIKE_STOCK_DECAY, STOCK_MIN, STOCK_MAX);
    const shock = prev.shock + (1 - prev.shock) * SHOCK_DECAY;
    const price = clamp(base * shock, STOCK_MIN, STOCK_MAX);
    stocks[cat.id] = {
      price: round2(price),
      prevPrice: prev.price,
      base: round2(base),
      shock: round2(shock),
    };
  }
  return { ...state, stocks };
}

/** Set a temporary multiplicative shock on one cat's stock within a stocks map. */
export function shockStockMap(
  stocks: Record<string, StockShare>,
  catId: string,
  multiplier: number,
): Record<string, StockShare> {
  const prev = stocks[catId];
  if (!prev) return stocks;
  const price = clamp(prev.base * multiplier, STOCK_MIN, STOCK_MAX);
  return { ...stocks, [catId]: { ...prev, shock: round2(multiplier), price: round2(price) } };
}

/** Apply a temporary multiplicative shock to one cat's stock (news-driven). */
export function applyStockShock(state: GameState, catId: string, multiplier: number): GameState {
  return { ...state, stocks: shockStockMap(state.stocks, catId, multiplier) };
}

/**
 * Buy one share (direct finance): the player pays the price and the CC flows
 * straight into that cat's wealth, funding its economic activity — the
 * "investment virtuous cycle". No-op if the cat has no stock or the player
 * can't afford it.
 */
export function executeBuy(state: GameState, catId: string): GameState {
  const stock = state.stocks[catId];
  if (!stock) return state;
  const price = stock.price;
  const { player } = state;
  if (player.cash < price) return state; // defensive: insufficient funds

  const cats = state.cats.map((c) =>
    c.id === catId ? { ...c, money: round2(c.money + price) } : c,
  );

  return {
    ...state,
    cats,
    player: {
      ...player,
      cash: round2(player.cash - price),
      holdings: { ...player.holdings, [catId]: (player.holdings[catId] ?? 0) + 1 },
      costBasis: { ...player.costBasis, [catId]: round2((player.costBasis[catId] ?? 0) + price) },
      hasEverInvested: true,
    },
  };
}

/**
 * Sell one share (direct finance): the player receives the price and that CC is
 * withdrawn from the cat's wealth. If the cat can't cover it, its wealth floors
 * at 0 and the system absorbs the shortfall. No-op if the player holds none.
 */
export function executeSell(state: GameState, catId: string): GameState {
  const stock = state.stocks[catId];
  if (!stock) return state;
  const { player } = state;
  const shares = player.holdings[catId] ?? 0;
  if (shares <= 0) return state; // defensive: nothing to sell

  const price = stock.price;
  const basis = player.costBasis[catId] ?? 0;
  // Reduce cost basis proportionally (average-cost method).
  const remainingBasis = shares > 1 ? round2(basis * ((shares - 1) / shares)) : 0;

  const cats = state.cats.map((c) =>
    c.id === catId ? { ...c, money: Math.max(0, round2(c.money - price)) } : c,
  );

  return {
    ...state,
    cats,
    player: {
      ...player,
      cash: round2(player.cash + price),
      holdings: { ...player.holdings, [catId]: shares - 1 },
      costBasis: { ...player.costBasis, [catId]: remainingBasis },
    },
  };
}

/** Unrealized profit/loss for the player's holding in one cat. */
export function unrealizedPnL(state: GameState, catId: string): number {
  const shares = state.player.holdings[catId] ?? 0;
  if (shares <= 0) return 0;
  const price = state.stocks[catId]?.price ?? 0;
  const basis = state.player.costBasis[catId] ?? 0;
  return round2(shares * price - basis);
}
