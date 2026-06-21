import type { GameState, NewsItem, PlacedFacility, RoadTile } from '@/types/game';
import { round2 } from './math';
import { REPAY_INTERVAL } from './loanDeadline';

// --- Tutorial economic constants --------------------------------------------
export const TUTORIAL_INVEST_COST = 300; // CC the player puts into ミケのスープ屋
export const DIVIDEND_AFTER_INVEST = 5; // CC/tick once the shop opens
export const DIVIDEND_AFTER_ROADS = 10; // CC/tick once the 石畳 connects the shop
export const TUTORIAL_REPAY_AMOUNT = 1000; // the first forced repayment
export const TUTORIAL_RELIEF_AMOUNT = 1200; // next repayment if the player is bailed out

// Names of the two starting cats (looked up by name, not id).
const MIKE = 'ミケ';
const TAMA = 'タマ';

// Where ミケのスープ屋 is built (map %, near ミケ and the central pot).
const SHOP_X = 40;
const SHOP_Y = 62;

// The 石畳 tiles stage 3 lays between the pot (grid 0,0) and the shop.
const ROAD_TO_SHOP: RoadTile[] = [
  { gx: 0, gz: 1 },
  { gx: -1, gz: 1 },
  { gx: -1, gz: 2 },
  { gx: -2, gz: 2 },
];

/** Prepend a templated headline to the news log (no API call). */
function withNews(state: GameState, event: string, text: string): NewsItem[] {
  const item: NewsItem = { tick: state.tick, event, text };
  return [item, ...state.newsLog].slice(0, 50);
}

/** Intro card dismissed → stage 1 (invest). */
export function tutorialStart(state: GameState): GameState {
  if (state.tutorial.phase !== 'intro') return state;
  return { ...state, tutorial: { ...state.tutorial, phase: 'invest' } };
}

/**
 * Stage 1 — the player invests 300CC in ミケ. Her soup shop opens (a soup
 * factory placed on the map), タマ starts working there, and a +5CC/tick
 * dividend begins. Advances to stage 2 (learn 「1日進める」).
 */
export function tutorialInvest(state: GameState): GameState {
  if (state.tutorial.phase !== 'invest') return state;

  const cats = state.cats.map((c) => {
    if (c.name === MIKE) {
      return { ...c, money: round2(c.money + TUTORIAL_INVEST_COST), action: 'working' as const, x: SHOP_X, y: SHOP_Y };
    }
    if (c.name === TAMA) {
      // タマ gets a job at the shop.
      return { ...c, action: 'working' as const, x: 48, y: 60 };
    }
    return c;
  });

  const shop: PlacedFacility = { id: 'tutorial-soup-shop', kind: 'soupFactory', x: SHOP_X, y: SHOP_Y };

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
    economy: {
      ...state.economy,
      soupPrice: 8,
      inflationRate: 1,
      unemploymentRate: 0, // both cats now have work
      inflationHistory: [...state.economy.inflationHistory, 0, 1].slice(-20),
    },
    market: { ...state.market, soupPrice: 8 },
    newsLog: withNews(state, 'チュートリアル', '【速報】ミケのスープ屋オープン！タマが働きはじめたニャ🍲'),
    tutorial: { ...state.tutorial, phase: 'advance', dividend: DIVIDEND_AFTER_INVEST },
  };
}

/**
 * Stage 2+ — advance the clock by ONE tick (the only thing that moves time
 * during the tutorial). Pays the shop dividend, then:
 * - in `advance` (stage 2) the first press unlocks stage 3 (roads),
 * - reaching the repayment deadline opens the たぬきち collection scene.
 */
export function tutorialAdvanceDay(state: GameState): GameState {
  const { phase } = state.tutorial;
  if (phase !== 'advance' && phase !== 'roads' && phase !== 'repayWait') return state;

  const tick = state.tick + 1;
  const cash = round2(state.player.cash + state.tutorial.dividend);

  // First 「1日進める」 press graduates stage 2 → stage 3 (roads). Otherwise keep
  // the current stage, unless the deadline has arrived.
  let nextPhase: GameState['tutorial']['phase'] = phase === 'advance' ? 'roads' : phase;
  if (tick >= state.repayDueTick) nextPhase = 'repayment';

  return {
    ...state,
    tick,
    player: { ...state.player, cash },
    tutorial: { ...state.tutorial, phase: nextPhase },
  };
}

/**
 * Stage 3 — connect ミケのスープ屋 to the giant pot with 石畳. Better logistics
 * lift the dividend from +5 to +10/tick, and cats on the road move twice as
 * fast (handled by the 3D scene). Advances to `repayWait`.
 */
export function tutorialLayRoads(state: GameState): GameState {
  if (state.tutorial.phase !== 'roads') return state;

  const existing = new Set(state.roads.map((r) => `${r.gx},${r.gz}`));
  const fresh = ROAD_TO_SHOP.filter((r) => !existing.has(`${r.gx},${r.gz}`));

  return {
    ...state,
    roads: [...state.roads, ...fresh],
    newsLog: withNews(state, 'チュートリアル', '【速報】石畳が開通！物流改善でスープの売上が伸びたニャ🛤️'),
    tutorial: { ...state.tutorial, phase: 'repayWait', dividend: DIVIDEND_AFTER_ROADS },
  };
}

/**
 * Stage 4 — repayment day. たぬきち collects the forced repayment.
 * - Enough cash → the loan shrinks and the village unlocks to level 2 (which
 *   reveals the 金利 lever and the rest of the dashboard).
 * - Not enough → a one-time 救済: たぬきち waits, but the next repayment rises to
 *   1,200CC. The guided dividend means the happy path is the usual one.
 * Either way the phase advances to `done`; the completion popup reads the result.
 */
export function tutorialRepay(state: GameState): GameState {
  if (state.tutorial.phase !== 'repayment') return state;

  const pay = Math.min(state.repayAmount, state.player.loan);

  if (state.player.cash >= pay) {
    return {
      ...state,
      player: {
        ...state.player,
        cash: round2(state.player.cash - pay),
        loan: round2(state.player.loan - pay),
      },
      villageLevel: 2,
      repayDueTick: state.tick + REPAY_INTERVAL,
      newsLog: withNews(
        state,
        'チュートリアル',
        '【速報】返済成功！村レベル2解放、金利レバーが使えるようになったニャ🎉',
      ),
      tutorial: { ...state.tutorial, phase: 'done' },
    };
  }

  // 救済: forgiven once, but the next repayment grows.
  return {
    ...state,
    repayAmount: TUTORIAL_RELIEF_AMOUNT,
    repayDueTick: state.tick + REPAY_INTERVAL,
    newsLog: withNews(
      state,
      'チュートリアル',
      `【救済】たぬきち「今回は待つニャ。でも返済が遅れると負担が増えるニャ」次回返済は${TUTORIAL_RELIEF_AMOUNT}CC`,
    ),
    tutorial: { ...state.tutorial, phase: 'done' },
  };
}

/** Close the completion popup and hand control to the player (free play). */
export function tutorialFinish(state: GameState): GameState {
  return { ...state, tutorial: { ...state.tutorial, active: false, phase: 'done' } };
}

/** Skip the rest of the tutorial entirely (unlocks the village to keep play sane). */
export function tutorialSkip(state: GameState): GameState {
  return {
    ...state,
    villageLevel: Math.max(state.villageLevel, 2),
    tutorial: { ...state.tutorial, active: false, phase: 'done' },
  };
}

/**
 * Pay the player the soup-shop dividend each tick of *free play* (the realtime
 * loop). During the tutorial the dividend is paid by `tutorialAdvanceDay`
 * instead, so this is a no-op while the tutorial is active.
 */
export function applyDividend(state: GameState): GameState {
  if (state.tutorial.active) return state;
  const d = state.tutorial.dividend;
  if (d <= 0) return state;
  return { ...state, player: { ...state.player, cash: round2(state.player.cash + d) } };
}
