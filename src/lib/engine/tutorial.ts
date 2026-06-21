import type { Cat, GameState, NewsItem, PlacedFacility, RoadTile, StockShare } from '@/types/game';
import { round2 } from './math';
import { initStock } from './stocks';
import { REPAY_INTERVAL } from './loanDeadline';

// --- Tutorial economic constants --------------------------------------------
export const TUTORIAL_INVEST_COST = 300; // CC the player puts into ミケのスープ屋
export const DIVIDEND_AFTER_INVEST = 5; // CC/tick once the shop opens
export const DIVIDEND_AFTER_ROADS = 10; // CC/tick once the 石畳 connects the shop
export const TUTORIAL_RATE_STEP = 3; // how much the guided rate hike adds (%)
export const TUTORIAL_REPAY_AMOUNT = 1000; // the first forced repayment
export const TUTORIAL_RELIEF_AMOUNT = 1200; // next repayment if the player is bailed out

// Sales lumps the shop pays the player as each mission lands, so a diligent
// villager can cover the 1,000CC repayment (606 − 300 invest + 450 + 350 ≈ 1,106).
const SALES_AFTER_ROADS = 450; // 物流改善で売上が伸びる
const SALES_AFTER_RATE = 350; // 物価が安定して客足が戻る

// Names of the two starting cats (looked up by name, not id).
const MIKE = 'ミケ';
const TAMA = 'タマ';

// Where ミケのスープ屋 is built (map %, near ミケ and the central pot).
const SHOP_X = 40;
const SHOP_Y = 62;

// The 石畳 tiles mission 2 lays between the pot (grid 0,0) and the shop.
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

/** Intro card dismissed → start mission 1. */
export function tutorialStart(state: GameState): GameState {
  if (state.tutorial.phase !== 'intro') return state;
  return { ...state, tutorial: { ...state.tutorial, phase: 'mission1' } };
}

/**
 * Mission 1 — the player invests 300CC in ミケ. This opens her soup shop (a soup
 * factory placed on the map, which the 3D scene animates into being and whose
 * work-aura pulls タマ over to work), strengthens the village's soup-pot fire,
 * and starts a +5CC/tick dividend.
 */
export function tutorialInvest(state: GameState): GameState {
  if (state.tutorial.phase !== 'mission1') return state;

  const cats = state.cats.map((c) => {
    if (c.name === MIKE) {
      // ミケ now runs her shop on the spot the factory is placed.
      return { ...c, money: round2(c.money + TUTORIAL_INVEST_COST), action: 'working' as const, x: SHOP_X, y: SHOP_Y };
    }
    if (c.name === TAMA) {
      // タマ idles right next to the shop so the factory aura walks her in to work.
      return { ...c, action: 'idle' as const, x: 48, y: 60 };
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
    // Hand-set snapshot: the slump eases (price ticks up, a job appears, the
    // fire grows back).
    economy: {
      ...state.economy,
      soupPrice: 8,
      inflationRate: 2,
      unemploymentRate: 50,
      inflationHistory: [...state.economy.inflationHistory, 0, 2].slice(-20),
    },
    market: { ...state.market, soupPrice: 8 },
    repayDueTick: 12,
    newsLog: withNews(state, 'チュートリアル', '【速報】ミケのスープ屋オープン！タマが雇われ、鍋の火が強くなったニャ🍲🔥'),
    tutorial: { ...state.tutorial, phase: 'mission2', dividend: DIVIDEND_AFTER_INVEST },
  };
}

/**
 * Mission 2 — pave the 石畳 between the soup pot (centre) and ミケのスープ屋.
 * Faster delivery lifts sales (a one-off lump + the dividend to +10), and the
 * brisker money flow pushes prices up past 5% — setting up the interest lesson.
 */
export function tutorialLayRoads(state: GameState): GameState {
  if (state.tutorial.phase !== 'mission2') return state;

  // Lay the cobblestones directly (free during the guided tutorial), skipping
  // any cell already paved.
  const existing = new Set(state.roads.map((r) => `${r.gx},${r.gz}`));
  const fresh = ROAD_TO_SHOP.filter((r) => !existing.has(`${r.gx},${r.gz}`));

  return {
    ...state,
    roads: [...state.roads, ...fresh],
    player: { ...state.player, cash: round2(state.player.cash + SALES_AFTER_ROADS) },
    economy: {
      ...state.economy,
      soupPrice: 11,
      inflationRate: 8,
      unemploymentRate: 50,
      inflationHistory: [...state.economy.inflationHistory, 5, 8].slice(-20),
    },
    market: { ...state.market, soupPrice: 11 },
    repayDueTick: 7,
    newsLog: withNews(state, 'チュートリアル', `【速報】石畳が開通！物流改善でスープの売上 +${SALES_AFTER_ROADS}CC ニャ🛤️`),
    tutorial: { ...state.tutorial, phase: 'mission3', dividend: DIVIDEND_AFTER_ROADS },
  };
}

/**
 * Mission 3 — raise the interest rate to cool the rising prices. Inflation
 * settles back down (and the 3D banker flashes the player's climbing interest),
 * the calmer village brings customers back (a final sales lump), and the
 * tutorial moves on to the repayment scene.
 */
export function tutorialRaiseRate(state: GameState): GameState {
  if (state.tutorial.phase !== 'mission3') return state;

  const interestRate = Math.min(20, state.policy.interestRate + TUTORIAL_RATE_STEP);

  return {
    ...state,
    policy: { ...state.policy, interestRate },
    player: { ...state.player, cash: round2(state.player.cash + SALES_AFTER_RATE) },
    economy: {
      ...state.economy,
      soupPrice: 10,
      inflationRate: 3,
      unemploymentRate: 50,
      inflationHistory: [...state.economy.inflationHistory, 8, 3].slice(-20),
    },
    market: { ...state.market, soupPrice: 10 },
    repayDueTick: 2,
    newsLog: withNews(state, 'チュートリアル', '【速報】金利アップで物価が落ち着き、客足が戻ったニャ😼'),
    tutorial: { ...state.tutorial, phase: 'repayment' },
  };
}

/** The new villager シロ, who moves into the expanded district after repayment. */
function makeShiro(): { cat: Cat; stock: StockShare } {
  const cat: Cat = {
    id: '1',
    name: 'シロ',
    personality: 'aggressive',
    job: 'investor',
    money: 80,
    hunger: 30,
    energy: 90,
    inventory: 0,
    action: 'idle',
    x: 30,
    y: 42,
    ambition: 0.8,
    company: null,
  };
  return { cat, stock: initStock(cat.money) };
}

/**
 * Repayment day — たぬきち collects 1,000CC.
 * - Enough cash → success: the loan shrinks, the village unlocks to level 2, a
 *   new district opens with the newcomer シロ, and the stock market goes live.
 * - Not enough → a one-time 救済: たぬきち waits, but the next repayment rises to
 *   1,200CC. (The guided sales lumps mean the happy path is the usual one.)
 * Either way the phase advances to `done`; the completion popup reads the result.
 */
export function tutorialRepay(state: GameState): GameState {
  if (state.tutorial.phase !== 'repayment') return state;

  const pay = Math.min(state.repayAmount, state.player.loan);

  if (state.player.cash >= pay) {
    const { cat: shiro, stock } = makeShiro();
    return {
      ...state,
      player: {
        ...state.player,
        cash: round2(state.player.cash - pay),
        loan: round2(state.player.loan - pay),
      },
      cats: [...state.cats, shiro],
      stocks: { ...state.stocks, [shiro.id]: stock },
      villageLevel: 2,
      repayDueTick: state.tick + REPAY_INTERVAL,
      newsLog: withNews(
        state,
        'チュートリアル',
        '【速報】返済成功！村レベル2解放、新住民シロが引っ越してきたニャ🎉',
      ),
      tutorial: { ...state.tutorial, phase: 'done' },
    };
  }

  // 救済: forgiven once, but the stakes rise.
  return {
    ...state,
    repayAmount: TUTORIAL_RELIEF_AMOUNT,
    repayDueTick: state.tick + REPAY_INTERVAL,
    newsLog: withNews(
      state,
      'チュートリアル',
      `【救済】たぬきち「今回は待つニャ。でも次は本当に差し押さえるニャ」次回返済は${TUTORIAL_RELIEF_AMOUNT}CC`,
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
 * Pay the player the soup-shop dividend each tick (free play only — the sim is
 * frozen during the tutorial, so this first flows once the tutorial is done).
 */
export function applyDividend(state: GameState): GameState {
  const d = state.tutorial.dividend;
  if (d <= 0) return state;
  return { ...state, player: { ...state.player, cash: round2(state.player.cash + d) } };
}
