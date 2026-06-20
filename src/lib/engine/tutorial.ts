import type { GameState, NewsItem, PlacedFacility } from '@/types/game';
import { round2 } from './math';
import { layRoad } from './roads';

// --- Tutorial economic constants --------------------------------------------
export const TUTORIAL_INVEST_COST = 300; // CC the player puts into ミケのスープ屋
export const DIVIDEND_AFTER_INVEST = 10; // CC/tick once the shop opens
export const DIVIDEND_AFTER_ROADS = 20; // CC/tick once logistics improve
export const TUTORIAL_RATE_STEP = 3; // how much the guided rate hike adds (%)

// Names of the two cats the cinematic features (looked up by name, not id, so
// the tutorial survives any reordering of INITIAL_CATS).
const MIKE = 'ミケ';
const TAMA = 'タマ';

/** Prepend a templated headline to the news log (no API call). */
function withNews(state: GameState, event: string, text: string): NewsItem[] {
  const item: NewsItem = { tick: state.tick, event, text };
  return [item, ...state.newsLog].slice(0, 50);
}

/** Opening cinematic finished → start mission 1. */
export function tutorialAdvance(state: GameState): GameState {
  if (state.tutorial.phase !== 'opening') return state;
  return { ...state, tutorial: { ...state.tutorial, phase: 'mission1' } };
}

/**
 * Mission 1 — the player invests 300CC in ミケ. This opens her soup shop
 * (a soup factory placed on the map, which the 3D scene animates into being and
 * whose work-aura pulls タマ over to work), nudges the economy out of its slump,
 * and starts a +10CC/tick dividend.
 */
export function tutorialInvest(state: GameState): GameState {
  if (state.tutorial.phase !== 'mission1') return state;

  const cats = state.cats.map((c) => {
    if (c.name === MIKE) {
      // ミケ now runs her shop at the plaza-side spot the factory is placed on.
      return { ...c, money: round2(c.money + TUTORIAL_INVEST_COST), action: 'working' as const, x: 35, y: 60 };
    }
    if (c.name === TAMA) {
      // タマ idles right next to the shop so the factory aura walks her in.
      return { ...c, action: 'idle' as const, x: 42, y: 56 };
    }
    return c;
  });

  const shop: PlacedFacility = { id: 'tutorial-soup-shop', kind: 'soupFactory', x: 35, y: 60 };

  return {
    ...state,
    cats,
    player: {
      ...state.player,
      cash: round2(state.player.cash - TUTORIAL_INVEST_COST),
      hasEverInvested: true,
    },
    facilities: { ...state.facilities, soupFactory: state.facilities.soupFactory + 1 },
    placements: [...state.placements, shop],
    // Hand-set snapshot: the slump eases (price ticks up, jobs appear).
    economy: {
      ...state.economy,
      soupPrice: 8,
      inflationRate: 2,
      unemploymentRate: 40,
      inflationHistory: [...state.economy.inflationHistory, 0, 2].slice(-20),
    },
    market: { ...state.market, soupPrice: 8 },
    newsLog: withNews(state, 'チュートリアル', '【速報】ミケのスープ屋オープン！村に雇用が生まれたニャ🍲'),
    tutorial: { ...state.tutorial, phase: 'mission2', dividend: DIVIDEND_AFTER_INVEST },
  };
}

/**
 * Mission 2 — pave the road between the soup pot (centre) and ミケのスープ屋.
 * Faster delivery lifts sales (and the dividend to +20), and the brisker money
 * flow starts to push prices up — setting up the interest-rate lesson.
 */
export function tutorialLayRoads(state: GameState): GameState {
  if (state.tutorial.phase !== 'mission2') return state;

  // Two tiles along the path from the central pot toward the shop.
  let s = layRoad(state, -1, 1);
  s = layRoad(s, -2, 2);

  return {
    ...s,
    economy: {
      ...s.economy,
      soupPrice: 11,
      inflationRate: 14,
      unemploymentRate: 30,
      inflationHistory: [...s.economy.inflationHistory, 8, 14].slice(-20),
    },
    market: { ...s.market, soupPrice: 11 },
    newsLog: withNews(s, 'チュートリアル', '【速報】道路が開通！物流が改善してスープの売上が上昇したニャ🛤️'),
    tutorial: { ...s.tutorial, phase: 'mission3', dividend: DIVIDEND_AFTER_ROADS },
  };
}

/**
 * Mission 3 — raise the interest rate to cool the rising prices. Inflation
 * settles back down (and the 3D banker flashes the player's climbing interest).
 * The tutorial stays paused until TUTORIAL_FINISH so the closing popups read at
 * the player's pace.
 */
export function tutorialRaiseRate(state: GameState): GameState {
  if (state.tutorial.phase !== 'mission3') return state;

  const interestRate = Math.min(20, state.policy.interestRate + TUTORIAL_RATE_STEP);

  return {
    ...state,
    policy: { ...state.policy, interestRate },
    economy: {
      ...state.economy,
      soupPrice: 10,
      inflationRate: 3,
      unemploymentRate: 30,
      inflationHistory: [...state.economy.inflationHistory, 8, 3].slice(-20),
    },
    market: { ...state.market, soupPrice: 10 },
    newsLog: withNews(state, 'チュートリアル', '【速報】金利アップで物価が落ち着いたニャ。村は安定したニャ😼'),
    tutorial: { ...state.tutorial, phase: 'done' },
  };
}

/** Close the tutorial and hand control to the player (free play resumes). */
export function tutorialFinish(state: GameState): GameState {
  return { ...state, tutorial: { ...state.tutorial, active: false, phase: 'done' } };
}

/** Skip the rest of the tutorial entirely. */
export function tutorialSkip(state: GameState): GameState {
  return { ...state, tutorial: { ...state.tutorial, active: false, phase: 'done' } };
}

/**
 * Pay the player the soup-shop dividend each tick (free play only — the sim is
 * frozen during the tutorial, so this first flows once the tutorial is done).
 */
export function applyDividend(state: GameState): GameState {
  const d = state.tutorial.dividend;
  if (d <= 0) return state;
  return { ...state, player: { ...state.player, cash: round2(state.player.cash + d) } };
}
