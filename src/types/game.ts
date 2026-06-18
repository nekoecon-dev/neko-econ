// Shared domain types for NekoEcon.

export type Personality = 'aggressive' | 'conservative' | 'lazy';
export type Job = 'investor' | 'producer' | 'trader';
export type CatAction = 'idle' | 'working' | 'eating' | 'sleeping';

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

export interface NewsItem {
  tick: number;
  event: string;
  text: string;
}

export interface GameState {
  tick: number;
  cats: Cat[];
  market: Market;
  economy: Economy;
  policy: PlayerPolicy;
  newsLog: NewsItem[];
}

export type PolicyAction =
  | { type: 'ISSUE_CURRENCY'; amount: number }
  | { type: 'SET_INTEREST_RATE'; value: number }
  | { type: 'SET_TAX_RATE'; value: number };
