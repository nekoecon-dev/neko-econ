// Shared domain types for NekoEcon.

export type Personality = 'aggressive' | 'conservative' | 'lazy';
export type Job = 'investor' | 'producer' | 'trader';
export type CatAction = 'idle' | 'working' | 'eating' | 'sleeping';

/** A venture founded by an entrepreneurial cat. */
export interface CompanyState {
  name: string;
  foundedTick: number;
}

export interface Cat {
  id: string;
  name: string;
  personality: Personality;
  job: Job;
  money: number; // CC
  hunger: number; // 0..100 (100 = starving)
  energy: number; // 0..100 (0 = exhausted)
  inventory: number; // soup units held
  action: CatAction;
  x: number; // 0..100 (% horizontal position on the map)
  y: number; // 0..100 (% vertical position on the map)
  ambition: number; // 0..1 entrepreneurial drive (chance of founding a company)
  company: CompanyState | null; // active venture, or null
}

export interface Market {
  soupPrice: number;
  supply: number; // soup units offered to the market this tick
  demand: number; // soup units demanded this tick
}

export interface Economy {
  soupPrice: number;
  inflationRate: number; // percent, vs previous tick
  unemploymentRate: number; // percent
  gini: number; // 0..1
  totalMoney: number; // sum of all cats' money
  inflationHistory: number[]; // last 20 inflation rates
}

export interface PlayerPolicy {
  interestRate: number; // 0..20 (%)
  taxRate: number; // 0..50 (%)
}

/** Overall economic mood, used to tint the village. */
export type VillageMood = 'boom' | 'normal' | 'recession';

/** Economy-driven weather/atmosphere for the village map. */
export type Weather = 'boom' | 'hyperinflation' | 'depression' | 'normal';

/**
 * Active weather plus a minimum-duration lock. Dramatic weather
 * (hyperinflation / depression) holds until `lockUntil` (a Date.now() epoch-ms
 * timestamp) so it doesn't flicker away the instant the trigger eases.
 */
export interface WeatherState {
  current: Weather;
  lockUntil: number;
}

/**
 * Labor strike state. Triggered by extreme inequality; resolved by raising tax
 * or by repeated relief payouts (with a failsafe max duration).
 */
export interface StrikeState {
  active: boolean;
  reliefCount: number; // +100CC distributions made during this strike
  startTick: number;
  cooldownUntil: number; // no new strike may start before this tick
}

export interface NewsItem {
  tick: number;
  event: string;
  text: string;
}

/**
 * Result of event detection. `catId`/`catName` are set for cat-specific events
 * (破産 / 大儲け) which also drive that cat's stock price.
 */
export interface DetectedEvent {
  name: string;
  catId?: string;
  catName?: string;
}

/** Tradable share for a single cat. */
export interface StockShare {
  price: number; // displayed price = base * shock, clamped to [10, 9999]
  prevPrice: number; // price on the previous tick (for ▲/▼ direction)
  base: number; // fundamental price, smoothly tracks the cat's money level
  shock: number; // temporary news multiplier, decays back to 1
}

/** The human player's portfolio (independent of the NPC cats). */
export interface PlayerWallet {
  cash: number; // CC
  holdings: Record<string, number>; // catId -> shares owned
  costBasis: Record<string, number>; // catId -> total CC spent on current shares
  hasEverInvested: boolean; // gates the one-time education popup
  loan: number; // outstanding debt to シロ銀行 (0 = paid off -> house upgraded)
}

/** Public-works facilities the player can build to steer the economy. */
export type FacilityKind = 'soupFactory' | 'matatabiPark' | 'fishingPond';
export type FacilityState = Record<FacilityKind, number>; // kind -> count built

/** A facility the player has dropped onto a specific spot on the map. */
export interface PlacedFacility {
  id: string;
  kind: FacilityKind;
  x: number; // 0..100 (% horizontal position on the map)
  y: number; // 0..100 (% vertical position on the map)
}

/**
 * Mission progress. Missions are completed one at a time in order; `index` is
 * the current mission (equal to the mission count once all are done).
 * `lastRewardTick` is the tick of the most recent completion (-1 if none) and
 * drives the transient reward popup.
 */
export interface MissionState {
  index: number;
  lastRewardTick: number;
}

export interface GameState {
  tick: number;
  cats: Cat[];
  market: Market;
  economy: Economy;
  policy: PlayerPolicy;
  newsLog: NewsItem[];
  stocks: Record<string, StockShare>; // keyed by catId
  player: PlayerWallet;
  weather: WeatherState;
  strike: StrikeState;
  facilities: FacilityState; // running count per kind (drives economic effects)
  placements: PlacedFacility[]; // individual buildings dropped on the map
  missions: MissionState; // village-management mission progress
}

export type PolicyAction =
  | { type: 'ISSUE_CURRENCY'; amount: number }
  | { type: 'SET_INTEREST_RATE'; value: number }
  | { type: 'SET_TAX_RATE'; value: number }
  | { type: 'BUY_STOCK'; catId: string }
  | { type: 'SELL_STOCK'; catId: string }
  | { type: 'REPAY_LOAN'; amount: number }
  | { type: 'PLACE_FACILITY'; kind: FacilityKind; x: number; y: number };
