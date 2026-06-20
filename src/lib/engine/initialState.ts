import type { Cat, GameState, StockShare } from '@/types/game';
import { initStock } from './stocks';
import { INITIAL_LOAN } from './loan';
import { REPAY_INTERVAL } from './loanDeadline';

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
  gameOver: false,
  bubbles: {},
  roads: [],
  // Free-play / automated-test baseline: the tutorial is already finished.
  tutorial: { active: false, phase: 'done', dividend: 0 },
};

// Chapter 0 — "ネコ村、差し押さえ寸前". The real game boots into this state: the
// village is in a slump (80% unemployment, デフレ寄り), the player owes 9,000CC
// with a forced repayment looming in 18 ticks, and the guided tutorial is active
// (which freezes the sim until the player finishes it).
export const TUTORIAL_INITIAL_STATE: GameState = {
  ...INITIAL_STATE,
  player: { ...INITIAL_STATE.player, cash: 1200, loan: 9000 },
  repayDueTick: 18,
  market: { soupPrice: 6, supply: 0, demand: 0 },
  economy: {
    soupPrice: 6,
    inflationRate: -3,
    unemploymentRate: 80,
    gini: 0.2,
    totalMoney: INITIAL_CATS.length * INITIAL_MONEY,
    inflationHistory: [-1, -2, -3],
  },
  tutorial: { active: true, phase: 'opening', dividend: 0 },
};
