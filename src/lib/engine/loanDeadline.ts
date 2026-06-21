import type { GameState, NewsItem } from '@/types/game';
import { round2 } from './math';

export const REPAY_INTERVAL = 50; // ticks between forced repayment deadlines
export const FORCED_REPAY = 1000; // CC drawn at each deadline
export const REPAY_WARN_TICKS = 10; // countdown turns red within this many ticks

/**
 * Enforce the periodic loan deadline (every REPAY_INTERVAL ticks):
 * - loan already paid off → just roll the deadline forward,
 * - enough cash → auto-draw the forced repayment and announce it,
 * - not enough cash → 差し押さえ: the game is over.
 * Pure; runs once per tick from the game loop.
 */
export function updateLoanDeadline(state: GameState): GameState {
  if (state.gameOver) return state;
  if (state.tick < state.repayDueTick) return state;

  // Already debt-free: no payment needed, just schedule the next checkpoint.
  if (state.player.loan <= 0) {
    return { ...state, repayDueTick: state.repayDueTick + REPAY_INTERVAL };
  }

  const pay = Math.min(state.repayAmount, state.player.loan);

  if (state.player.cash >= pay) {
    const remaining = round2(state.player.loan - pay);
    const news: NewsItem = {
      tick: state.tick,
      event: '返済日',
      text: `【返済日】たぬきちに${pay}CC返済しました。残り借金 ${Math.round(remaining)}CC ニャ`,
    };
    return {
      ...state,
      player: {
        ...state.player,
        cash: round2(state.player.cash - pay),
        loan: remaining,
      },
      // A villager who pays on time keeps the village unlocked (recovers a
      // 救済-downgraded level too).
      villageLevel: Math.max(state.villageLevel, 2),
      repayDueTick: state.repayDueTick + REPAY_INTERVAL,
      newsLog: [news, ...state.newsLog].slice(0, 50),
    };
  }

  // Can't cover the payment → foreclosure → game over.
  const news: NewsItem = {
    tick: state.tick,
    event: '差し押さえ',
    text: '【速報】返済できず、たぬきちに家を差し押さえられたニャ…',
  };
  return { ...state, gameOver: true, newsLog: [news, ...state.newsLog].slice(0, 50) };
}
