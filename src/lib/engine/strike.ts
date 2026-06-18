import type { GameState, NewsItem } from '@/types/game';

export const GINI_STRIKE_THRESHOLD = 0.7; // inequality that sparks a strike
export const STRIKE_TAX_RESOLVE = 30; // tax rate (%) that ends a strike
export const STRIKE_RELIEF_RESOLVE = 3; // +100CC payouts that end a strike
const STRIKE_MAX_TICKS = 120; // failsafe: a strike always ends eventually
const STRIKE_COOLDOWN = 60; // ticks after a strike before another can start
export const STRIKE_STOCK_DECAY = 0.99; // -1% per tick on every stock

function pushNews(state: GameState, item: NewsItem): NewsItem[] {
  return [item, ...state.newsLog].slice(0, 50);
}

/**
 * Toggle the strike each tick:
 * - starts when the Gini coefficient exceeds the threshold,
 * - ends when tax >= 30%, after 3 relief payouts, or after the failsafe max
 *   duration (so it can never lock the simulation forever).
 * While active, cats stop working (handled in updateAllCats), the soup price is
 * frozen (updateEconomy), and every stock bleeds -1%/tick (updateStocks).
 */
export function updateStrike(state: GameState): GameState {
  const { strike, economy, policy, tick } = state;

  if (!strike.active) {
    // Respect the cooldown so a strike can't immediately re-trigger before the
    // economy has had a chance to redistribute and bring the Gini back down.
    if (economy.gini > GINI_STRIKE_THRESHOLD && tick >= strike.cooldownUntil) {
      return {
        ...state,
        strike: { ...strike, active: true, reliefCount: 0, startTick: tick },
        newsLog: pushNews(state, {
          tick,
          event: 'ストライキ',
          text: '【速報】格差の拡大に怒った猫たちがストライキに突入したニャ！',
        }),
      };
    }
    return state;
  }

  const resolved =
    policy.taxRate >= STRIKE_TAX_RESOLVE ||
    strike.reliefCount >= STRIKE_RELIEF_RESOLVE ||
    tick - strike.startTick >= STRIKE_MAX_TICKS;

  if (resolved) {
    return {
      ...state,
      strike: { active: false, reliefCount: 0, startTick: 0, cooldownUntil: tick + STRIKE_COOLDOWN },
      newsLog: pushNews(state, {
        tick,
        event: 'スト終結',
        text: '【速報】ストライキが終結、猫たちが仕事に戻ったニャ。',
      }),
    };
  }

  return state;
}
