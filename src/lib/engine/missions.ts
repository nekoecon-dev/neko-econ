import type { GameState, NewsItem } from '@/types/game';
import { round2 } from './math';

export const MISSION_REWARD = 500; // ニャル granted on each completion
export const MISSION_START_TICK = 10; // let the sim settle before evaluating
export const MISSION_POPUP_TICKS = 6; // how long the reward popup lingers (~3s)

export interface Mission {
  id: number;
  title: string;
  hint: string;
  test: (s: GameState) => boolean;
}

/** The fixed sequence of village-management goals. */
export const MISSIONS: Mission[] = [
  {
    id: 1,
    title: '失業率を50%以下にしよう',
    hint: '猫が働ける環境を整えるニャ',
    test: (s) => s.economy.unemploymentRate <= 50,
  },
  {
    id: 2,
    title: 'インフレ率を5%以下に抑えよう',
    hint: '通貨の発行しすぎに注意ニャ',
    test: (s) => s.economy.inflationRate <= 5,
  },
  {
    id: 3,
    title: '借金を半分返済しよう（残り5,000ニャル以下）',
    hint: 'テントをクリックして返済ニャ',
    test: (s) => s.player.loan <= 5000,
  },
];

/**
 * Advance the mission tracker one step when the current mission's condition is
 * met: grant the reward to the player, bump the index, stamp the completion
 * tick (for the popup), and announce it in the news ticker. Pure — runs each
 * tick from the game loop.
 */
export function updateMissions(state: GameState): GameState {
  const { index } = state.missions;
  if (index >= MISSIONS.length) return state;
  if (state.tick < MISSION_START_TICK) return state;

  const mission = MISSIONS[index];
  if (!mission.test(state)) return state;

  const news: NewsItem = {
    tick: state.tick,
    event: 'ミッション',
    text: `【ミッション達成】${mission.title}！ ごほうび +${MISSION_REWARD}ニャル ニャ！`,
  };
  return {
    ...state,
    player: { ...state.player, cash: round2(state.player.cash + MISSION_REWARD) },
    missions: { index: index + 1, lastRewardTick: state.tick },
    newsLog: [news, ...state.newsLog].slice(0, 50),
  };
}
