import type { Cat, GameState, RoadTile, StockShare } from '@/types/game';
import { initStock } from './stocks';
import { INITIAL_LOAN } from './loan';
import { FORCED_REPAY, REPAY_INTERVAL } from './loanDeadline';

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
  villageLevel: 2, // free-play baseline: the whole village is already unlocked
  gameOver: false,
  bubbles: {},
  roads: [],
  // Free-play / automated-test baseline: the tutorial is already finished.
  tutorial: { active: false, phase: 'done', dividend: 0 },
};

// ---------------------------------------------------------------------------
// Story tutorial — "火の消えかけたネコ村" -----------------------------------
//
// The player is a new villager in debt. The starting village is deliberately
// small and dense: just two neighbours (ミケ・タマ) clustered around the giant
// soup pot, with たぬきち running the bank and a few 石畳 already laid. シロ and
// the rest of the economy unlock once the first 1,000CC repayment is made.
// ---------------------------------------------------------------------------

const TUTORIAL_START_CASH = 606;
const TUTORIAL_LOAN = 9000;
const TUTORIAL_REPAY_TICKS = 18;

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

// A few decorative 石畳 tiles around the east side of the plaza (the mission-2
// road to ミケのスープ屋 is laid fresh on the south-west side, so no overlap).
const TUTORIAL_ROADS: RoadTile[] = [
  { gx: 2, gz: 0 },
  { gx: 2, gz: 1 },
  { gx: 1, gz: 2 },
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
  villageLevel: 1, // the village (and the stock market) is still locked
  roads: TUTORIAL_ROADS,
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
