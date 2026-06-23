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

/** A speculative "bubble" on a cat's stock (news-triggered, wall-clock timed). */
export interface BubbleState {
  until: number; // Date.now() epoch-ms at which the bubble bursts/lands
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

/** A laid road tile, identified by its integer grid cell (TILE-sized). */
export interface RoadTile {
  gx: number;
  gz: number;
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

/**
 * Story-tutorial stage. The guided tutorial unlocks one concept at a time and
 * only advances time when the player presses 「1日進める」 (no realtime auto-run):
 * `intro` (opening) → `invest` (stage 1: invest in ミケ) → `advance` (stage 2:
 * learn 「1日進める」) → `roads` (stage 3: connect the 石畳) → `repayWait` (advance
 * to the deadline) → `repayment` (stage 4: たぬきち collects) → `done` (free play).
 */
export type TutorialPhase =
  | 'intro'
  | 'invest'
  | 'advance'
  | 'roads'
  | 'repayWait'
  | 'repayment'
  | 'done';

export interface TutorialState {
  active: boolean; // true while the guided tutorial runs (freezes realtime ticks)
  phase: TutorialPhase;
  dividend: number; // CC/tick the player earns from ミケのスープ屋 (0 until invested)
}

// ---------------------------------------------------------------------------
// Life mode — an Animal-Crossing-style "living in the village" prototype that
// runs on top of the same 3D scene with the economy UI hidden. Time only moves
// when the player presses 「1日進める」.
// ---------------------------------------------------------------------------

export type GatherKind = 'mushroom' | 'fish' | 'wood' | 'flower' | 'bell';
export type FurnitureKind =
  | 'chair'
  | 'lamp'
  | 'rug'
  | 'plant'
  | 'statue'
  | 'table'
  | 'bed'
  | 'planter';
/** How the player funds ミケの屋台 on DAY5 — teaches 出資 / 貸付 / 贈与. */
export type StallChoice = 'invest' | 'lend' | 'gift';
export type LifeWeather = 'sunny' | 'rainy';
export type LifeTime = 'morning' | 'day' | 'evening';

/** A gatherable item lying on the ground (click to pick up). */
export interface GatherItem {
  id: string;
  kind: GatherKind;
  x: number; // 0..100 map %
  y: number;
}

/** A piece of furniture the player has placed near their tent. */
export interface PlacedFurniture {
  id: string;
  kind: FurnitureKind;
  x: number;
  y: number;
}

/** A piece of furniture placed inside the tent on the room grid. */
export interface InteriorItem {
  id: string;
  kind: FurnitureKind;
  gx: number; // grid column (0..GRID-1)
  gy: number; // grid row
  rot: number; // 0 / 90 / 180 / 270
}

/** A visiting cat that wanders in on 「1日進める」. */
export interface LifeVisitor {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** A one-shot visual effect the 3D scene plays whenever `id` changes. */
export interface LifeFx {
  id: number; // bump to fire; 0 = nothing pending
  kind: 'soup' | 'construct' | 'fireworks' | null;
  x: number; // map % where the effect plays
  y: number;
}

export interface LifeState {
  active: boolean; // life-mode prototype is on (economy UI hidden, sim paused)
  playerName: string; // the hero's name ('' until entered → defaults to ニャオ)
  day: number; // DAY 1..7 is the guided campaign; 8+ is free play
  dayDone: boolean; // today's objective is complete (gates 「次の日へ」)
  reward: number; // CC earned for today's objective (shown in the 目的達成 celebration)
  time: LifeTime;
  weather: LifeWeather;
  level: number; // village level (DAY7 festival bumps it to 2)
  sale: boolean; // たぬきち furniture sale (cheaper today)
  playerX: number; // map % the avatar is walking toward
  playerY: number;
  inventory: Record<GatherKind, number>;
  items: GatherItem[]; // gatherables on the ground
  furniture: PlacedFurniture[]; // (legacy) village-map furniture — unused in the campaign
  ownedFurniture: FurnitureKind[]; // bought, not yet placed (shown in the tent)
  interior: InteriorItem[]; // furniture placed inside the tent on the room grid
  inside: boolean; // the player is in the tent-interior screen
  visitors: LifeVisitor[]; // visiting cats
  soupsMade: number;
  shopOpen: boolean; // ミケの屋台 has been built (DAY5)
  shopUnlocked: boolean; // たぬきちの家具店 is open (DAY3)
  roadDone: boolean; // 屋台↔鍋 road connected (DAY6)
  dailyIncome: number; // CC paid each 「1日進める」 (stall / road)
  lendDays: number; // remaining days of ミケへの貸付 repayment (DAY5 「貸す」, 0 = none)
  loanUnlocked: boolean; // loan-repayment UI revealed (DAY7)
  intimacy: Record<string, number>; // catId -> 親密度 level 1..5 (missing = 1)
  intimacyExplained: boolean; // the first-time 親密度 popup has been shown
  hasLostItem: boolean; // carrying タマ's lost item (DAY4)
  hasMoved: boolean; // the player has walked at least once (DAY1 move hint)
  hintArrow: boolean; // show the 3D arrow pointing at the lost item (DAY4 hint)
  event: string | null; // latest 1日進める event toast
  notice: string | null; // big celebration / story-beat notification
  fx: LifeFx; // pending one-shot 3D effect
  seq: number; // monotonic id source for items / furniture / fx
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
  repayDueTick: number; // tick of the next forced loan repayment deadline
  repayAmount: number; // CC drawn at the next forced repayment (grows after a 救済)
  villageLevel: number; // 1 during the tutorial, 2+ once the village is unlocked
  gameOver: boolean; // true once the player is foreclosed on (freezes the sim)
  bubbles: Record<string, BubbleState>; // catId -> active stock bubble
  roads: RoadTile[]; // laid road tiles (speed cats up + boost GDP)
  tutorial: TutorialState; // guided story-tutorial progress
  life: LifeState; // life-mode prototype (parallel to the economy sim)
}

export type PolicyAction =
  | { type: 'ISSUE_CURRENCY'; amount: number }
  | { type: 'SET_INTEREST_RATE'; value: number }
  | { type: 'SET_TAX_RATE'; value: number }
  | { type: 'BUY_STOCK'; catId: string }
  | { type: 'SELL_STOCK'; catId: string }
  | { type: 'REPAY_LOAN'; amount: number }
  | { type: 'PLACE_FACILITY'; kind: FacilityKind; x: number; y: number }
  | { type: 'LAY_ROAD'; gx: number; gz: number }
  | { type: 'TUTORIAL_START' } // intro card -> stage 1 (invest)
  | { type: 'TUTORIAL_INVEST' } // stage 1: invest 300CC in ミケ
  | { type: 'TUTORIAL_ADVANCE_DAY' } // stage 2+: advance one tick (pays the dividend)
  | { type: 'TUTORIAL_LAY_ROADS' } // stage 3: connect the 石畳 shop<->pot
  | { type: 'TUTORIAL_REPAY' } // stage 4: pay たぬきち & unlock the village
  | { type: 'TUTORIAL_FINISH' } // close the completion popup -> free play
  | { type: 'TUTORIAL_SKIP' } // skip the whole tutorial -> free play
  // --- Life mode -----------------------------------------------------------
  | { type: 'LIFE_SET_NAME'; name: string } // confirm the hero's name
  | { type: 'LIFE_MOVE'; x: number; y: number } // walk the avatar toward a spot
  | { type: 'LIFE_GATHER'; id: string } // pick up a gatherable item
  | { type: 'LIFE_GIVE_SOUP' } // give ミケ 3 mushrooms -> soup (DAY2 / free play)
  | { type: 'LIFE_GIVE_LOST' } // return タマ's lost item (DAY4)
  | { type: 'LIFE_SHOW_HINT' } // DAY4: reveal an arrow over the lost item
  | { type: 'LIFE_BUILD_STALL'; choice: StallChoice } // 3 wood + 200CC -> ミケの屋台 (DAY5)
  | { type: 'LIFE_CONNECT_ROAD' } // pave 屋台↔鍋 (DAY6)
  | { type: 'LIFE_REPAY' } // repay 300CC -> 村レベル2 festival (DAY7)
  | { type: 'LIFE_BUY_FURNITURE'; kind: FurnitureKind } // buy at たぬきち's shop -> owned
  | { type: 'LIFE_ENTER_TENT' } // open the tent-interior screen
  | { type: 'LIFE_EXIT_TENT' } // leave the tent-interior screen
  | { type: 'LIFE_PLACE_INTERIOR'; kind: FurnitureKind; gx: number; gy: number; rot: number } // place on grid
  | { type: 'LIFE_MOVE_INTERIOR'; id: string; gx: number; gy: number } // move a placed piece
  | { type: 'LIFE_ROTATE_INTERIOR'; id: string } // rotate a placed piece 90°
  | { type: 'LIFE_REMOVE_INTERIOR'; id: string } // 「しまう」 — back to owned
  | { type: 'LIFE_ADVANCE_DAY' } // advance one day (random visible event)
  | { type: 'LIFE_DISMISS_NOTICE' }; // close the big celebration popup
