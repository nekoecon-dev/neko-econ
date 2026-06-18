import type { GameState } from '@/types/game';
import { round2 } from './math';

// Per-tick interest as a fraction of the central-bank rate. Raising the rate
// to fight inflation also squeezes the indebted player.
const INTEREST_FACTOR = 0.01;

/**
 * Charge one tick of interest on the player's loan, drawn from cash. Cash is
 * floored at 0 so the player can never go negative (the bank just doesn't get
 * paid that tick). No-op when the loan is paid off.
 */
export function applyLoanInterest(state: GameState): GameState {
  const { player, policy } = state;
  if (player.loan <= 0) return state;
  const interest = round2(player.loan * (policy.interestRate / 100) * INTEREST_FACTOR);
  if (interest <= 0) return state;
  return {
    ...state,
    player: { ...player, cash: Math.max(0, round2(player.cash - interest)) },
  };
}

/** Repay up to `amount` of the loan from cash (bounded by both). */
export function repayLoan(state: GameState, amount: number): GameState {
  const { player } = state;
  const pay = Math.min(amount, player.cash, player.loan);
  if (pay <= 0) return state;
  return {
    ...state,
    player: { ...player, cash: round2(player.cash - pay), loan: round2(player.loan - pay) },
  };
}
