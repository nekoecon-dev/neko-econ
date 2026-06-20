import type { GameState, NewsItem, StockShare } from '@/types/game';
import { shockStockMap } from './stocks';

export const BUBBLE_MS = 15000; // a bubble lasts 15 wall-clock seconds
export const BUBBLE_BURST_CHANCE = 0.3; // chance the bubble bursts (vs soft-lands)
export const BUBBLE_BURST_SHOCK = 0.5; // burst: stock halves

/** Begin (or refresh) a 15s speculative bubble on a cat's stock. */
export function startBubble(state: GameState, catId: string): GameState {
  if (!state.stocks[catId]) return state;
  return {
    ...state,
    bubbles: { ...state.bubbles, [catId]: { until: Date.now() + BUBBLE_MS } },
  };
}

/**
 * Resolve any expired bubbles: 30% 倒産 (stock halves + crash headline), else
 * 軟着陸 (the bubble just ends and `base` re-converges to the cat's wealth via
 * the normal smoothing in updateStocks). Pure-ish; uses Date.now()/Math.random.
 */
export function resolveBubbles(state: GameState): GameState {
  const ids = Object.keys(state.bubbles);
  if (ids.length === 0) return state;

  const now = Date.now();
  let stocks: Record<string, StockShare> = state.stocks;
  const bubbles = { ...state.bubbles };
  const news: NewsItem[] = [];
  let changed = false;

  for (const id of ids) {
    if (now < state.bubbles[id].until) continue;
    changed = true;
    delete bubbles[id];
    const name = state.cats.find((c) => c.id === id)?.name ?? '猫';
    if (Math.random() < BUBBLE_BURST_CHANCE) {
      stocks = shockStockMap(stocks, id, BUBBLE_BURST_SHOCK);
      news.push({
        tick: state.tick,
        event: '倒産',
        text: `【速報】${name}のバブルが崩壊！株価が半額に大暴落ニャ…`,
      });
    } else {
      news.push({
        tick: state.tick,
        event: '軟着陸',
        text: `【速報】${name}のバブルは軟着陸、株価は徐々に正常化していくニャ。`,
      });
    }
  }

  if (!changed) return state;
  return {
    ...state,
    stocks,
    bubbles,
    newsLog: news.length ? [...news.reverse(), ...state.newsLog].slice(0, 50) : state.newsLog,
  };
}
