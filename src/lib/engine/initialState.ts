import type { Cat, GameState, StockShare } from '@/types/game';
import { initStock } from './stocks';
import { INITIAL_LOAN } from './loan';
import { FORCED_REPAY, REPAY_INTERVAL } from './loanDeadline';
import { lifeInactive, lifeInitial } from './life';

const INITIAL_MONEY = 100;
const INITIAL_PRICE = 10;
const PLAYER_INITIAL_CASH = 1000;

export const INITIAL_CATS: Cat[] = [
  {
    id: '1',
    name: 'シロ',
    personality: 'aggressive',
    job: 'investor',
    money: INITIAL_MONEY,
    hunger: 30,
    energy: 90,
    inventory: 0,
    action: 'idle',
    x: 20,
    y: 30,
    ambition: 0.8,
    company: null,
  },
  {
    id: '2',
    name: 'クロ',
    personality: 'conservative',
    job: 'producer',
    money: INITIAL_MONEY,
    hunger: 40,
    energy: 80,
    inventory: 1,
    action: 'idle',
    x: 55,
    y: 25,
    ambition: 0.3,
    company: null,
  },
  {
    id: '3',
    name: 'タマ',
    personality: 'lazy',
    job: 'producer',
    money: INITIAL_MONEY,
    hunger: 50,
    energy: 70,
    inventory: 1,
    action: 'idle',
    x: 75,
    y: 50,
    ambition: 0.2,
    company: null,
  },
  {
    id: '4',
    name: 'ミケ',
    personality: 'conservative',
    job: 'trader',
    money: INITIAL_MONEY,
    hunger: 35,
    energy: 85,
    inventory: 0,
    action: 'idle',
    x: 35,
    y: 60,
    ambition: 0.45,
    company: null,
  },
  {
    id: '5',
    name: 'チャトラ',
    personality: 'aggressive',
    job: 'trader',
    money: INITIAL_MONEY,
    hunger: 45,
    energy: 75,
    inventory: 0,
    action: 'idle',
    x: 60,
    y: 70,
    ambition: 0.7,
    company: null,
  },
];

export const INITIAL_STATE: GameState = {
  tick: 0,
  cats: INITIAL_CATS,
  market: {
    soupPrice: INITIAL_PRICE,
    supply: 0,
    demand: 0,
  },
  economy: {
    soupPrice: INITIAL_PRICE,
    inflationRate: 0,
    unemploymentRate: 0,
    gini: 0,
    totalMoney: INITIAL_CATS.length * INITIAL_MONEY,
    inflationHistory: [],
  },
  policy: {
    interestRate: 5,
    taxRate: 10,
  },
  newsLog: [],
  stocks: Object.fromEntries(
    INITIAL_CATS.map((c): [string, StockShare] => [c.id, initStock(c.money)]),
  ),
  player: {
    cash: PLAYER_INITIAL_CASH,
    holdings: {},
    costBasis: {},
    hasEverInvested: false,
    loan: INITIAL_LOAN,
  },
  weather: { current: 'normal', lockUntil: 0 },
  strike: { active: false, reliefCount: 0, startTick: 0, cooldownUntil: 0 },
  facilities: { soupFactory: 0, matatabiPark: 0, fishingPond: 0 },
  placements: [],
  missions: { index: 0, lastRewardTick: -1 },
  repayDueTick: REPAY_INTERVAL,
  repayAmount: FORCED_REPAY,
  villageLevel: 3, // free-play baseline: everything (incl. the stock market) unlocked
  gameOver: false,
  bubbles: {},
  roads: [],
  // Free-play / automated-test baseline: the tutorial is already finished.
  tutorial: { active: false, phase: 'done', dividend: 0 },
  life: lifeInactive(),
};

// ---------------------------------------------------------------------------
// Story tutorial — "火の消えかけたネコ村" -----------------------------------
//
// The player is a new villager in debt. The starting village is deliberately
// small: just two neighbours (ミケ・タマ) around the giant soup pot, with
// たぬきち at the bank. Time only moves when the player presses 「1日進める」, and
// each stage unlocks exactly one concept (invest → advance → roads → repay).
// ---------------------------------------------------------------------------

const TUTORIAL_START_CASH = 1075;
const TUTORIAL_LOAN = 8000;
const TUTORIAL_REPAY_TICKS = 28;

// Only two cats live here at the start (ids reuse the canonical styles so they
// render with the right coats): ミケ the would-be shopkeeper and タマ the
// jobless neighbour. They stand close together near the central plaza.
export const TUTORIAL_CATS: Cat[] = [
  {
    id: '4',
    name: 'ミケ',
    personality: 'conservative',
    job: 'trader',
    money: 40,
    hunger: 35,
    energy: 85,
    inventory: 0,
    action: 'idle',
    x: 40,
    y: 56,
    ambition: 0.45,
    company: null,
  },
  {
    id: '3',
    name: 'タマ',
    personality: 'lazy',
    job: 'producer',
    money: 30,
    hunger: 55,
    energy: 70,
    inventory: 0,
    action: 'idle',
    x: 60,
    y: 58,
    ambition: 0.2,
    company: null,
  },
];

export const TUTORIAL_INITIAL_STATE: GameState = {
  ...INITIAL_STATE,
  cats: TUTORIAL_CATS,
  stocks: Object.fromEntries(
    TUTORIAL_CATS.map((c): [string, StockShare] => [c.id, initStock(c.money)]),
  ),
  player: { ...INITIAL_STATE.player, cash: TUTORIAL_START_CASH, loan: TUTORIAL_LOAN },
  repayDueTick: TUTORIAL_REPAY_TICKS,
  repayAmount: FORCED_REPAY,
  villageLevel: 1, // levers / stocks / news are all still locked
  roads: [], // no roads yet — the player lays them in stage 3
  market: { soupPrice: 6, supply: 0, demand: 0 },
  economy: {
    soupPrice: 6,
    inflationRate: -3,
    unemploymentRate: 100, // nobody is working — the pot's fire is dying
    gini: 0.15,
    totalMoney: TUTORIAL_CATS.reduce((sum, c) => sum + c.money, 0),
    inflationHistory: [-1, -2, -3],
  },
  tutorial: { active: true, phase: 'intro', dividend: 0 },
};

// ---------------------------------------------------------------------------
// Life mode — the default boot experience. A cosy two-cat village (ミケ・タマ)
// with the economy paused and its UI hidden; the player gathers, cooks soup,
// earns CC, and decorates. No debt to worry about yet.
// ---------------------------------------------------------------------------
export const LIFE_INITIAL_STATE: GameState = {
  ...INITIAL_STATE,
  cats: TUTORIAL_CATS,
  stocks: Object.fromEntries(
    TUTORIAL_CATS.map((c): [string, StockShare] => [c.id, initStock(c.money)]),
  ),
  player: { ...INITIAL_STATE.player, cash: 250, loan: 1000 }, // テント代1,000CC
  villageLevel: 1,
  tutorial: { active: false, phase: 'done', dividend: 0 },
  life: lifeInitial(),
};
