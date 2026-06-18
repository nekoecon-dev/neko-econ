import type { GameState, NewsItem, StockShare } from '@/types/game';
import { shockStockMap } from './stocks';

const FOUND_MONEY = 500; // wealth needed to consider founding a venture
const FOUND_PROB = 0.05; // base per-tick chance, scaled by the cat's ambition
const COMPANY_MIN_TICKS = 40; // a venture must survive this long before it can fail
const BANKRUPT_PROB = 0.03; // per-tick chance of failing after the min lifetime
const SUCCESS_SHOCK = 2.0; // founding success: stock doubles
const BANKRUPT_SHOCK = 0.5; // bankruptcy: stock halves

const VENTURE_NAMES = ['もふもふ', 'ちゅ〜る', 'こたつ', 'またたび', 'ねこじゃらし', 'にゃんにゃん'];

/**
 * Entrepreneurship lifecycle (stochastic):
 * - a cat with >= 500 CC may found a venture (chance scales with `ambition`):
 *   news headline + the market cheers, doubling its stock.
 * - an established venture (older than COMPANY_MIN_TICKS) may go bankrupt:
 *   news headline + its stock halves.
 * Active ventures hire idle cats (handled in updateAllCats via the `hiring`
 * flag), lowering unemployment.
 */
export function updateCompanies(state: GameState): GameState {
  const news: NewsItem[] = [];
  const shocks: { catId: string; mult: number }[] = [];

  const cats = state.cats.map((cat) => {
    if (!cat.company) {
      if (cat.money >= FOUND_MONEY && Math.random() < FOUND_PROB * cat.ambition) {
        const name = VENTURE_NAMES[Math.floor(Math.random() * VENTURE_NAMES.length)];
        shocks.push({ catId: cat.id, mult: SUCCESS_SHOCK });
        news.push({
          tick: state.tick,
          event: '起業',
          text: `【速報】${cat.name}氏、${name}ベンチャーを起業！株価が急騰ニャ！`,
        });
        return { ...cat, company: { name, foundedTick: state.tick } };
      }
      return cat;
    }

    if (
      state.tick - cat.company.foundedTick >= COMPANY_MIN_TICKS &&
      Math.random() < BANKRUPT_PROB
    ) {
      shocks.push({ catId: cat.id, mult: BANKRUPT_SHOCK });
      news.push({
        tick: state.tick,
        event: '倒産',
        text: `【速報】${cat.name}氏の${cat.company.name}ベンチャー、倒産…株価が暴落ニャ。`,
      });
      return { ...cat, company: null };
    }
    return cat;
  });

  if (news.length === 0) return { ...state, cats };

  let stocks: Record<string, StockShare> = state.stocks;
  for (const s of shocks) stocks = shockStockMap(stocks, s.catId, s.mult);
  const newsLog = [...news.reverse(), ...state.newsLog].slice(0, 50);

  return { ...state, cats, stocks, newsLog };
}
