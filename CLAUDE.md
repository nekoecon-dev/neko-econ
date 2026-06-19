@AGENTS.md

# NekoEcon — 猫の経済シミュレーション (Phase 1 prototype)

A small browser game where 5 cats live in a village and run a tiny economy. The
player acts as the "central bank / government": issue currency, set the interest
rate and the tax rate, and watch inflation, unemployment and inequality respond
in real time. When the economy crosses certain thresholds, an AI-written news
ticker reports it.

Stack: Next.js 16 (App Router) · React 19 · TypeScript (strict, **no `any`**) ·
Tailwind v4 · Recharts · `@anthropic-ai/sdk` (server-side only).

## Directory layout

```
src/
  app/
    page.tsx              # main screen, 'use client', calls useGameLoop()
    layout.tsx
    globals.css
    api/news/route.ts     # POST /api/news -> { news } (server-side AI call)
  components/
    CatSprite.tsx
    VillageMap.tsx
    EconomyDashboard.tsx
    ControlPanel.tsx
    NewsTicker.tsx
  hooks/
    useGameLoop.ts        # 500ms tick loop, owns GameState
  lib/engine/
    math.ts               # clamp / round2 helpers
    economy.ts            # price / inflation / unemployment / gini / updateEconomy
    cats.ts               # decideCatAction / updateCat / updateAllCats
    events.ts             # detectEvent (with per-event cooldown)
    news.ts               # prompt builder + local fallback text
    initialState.ts       # INITIAL_STATE, INITIAL_CATS
  types/
    game.ts               # all shared types
```

## Core types (`src/types/game.ts`)

```ts
type Personality = 'aggressive' | 'conservative' | 'lazy';
type Job         = 'investor' | 'producer' | 'trader';
type CatAction   = 'idle' | 'working' | 'eating' | 'sleeping';

interface Cat {
  id, name: string;
  personality: Personality;
  job: Job;
  money: number;       // CC
  hunger: number;      // 0..100  (100 = starving)
  energy: number;      // 0..100  (0 = exhausted)
  inventory: number;   // soup units held
  action: CatAction;
  x, y: number;        // 0..100  (% position on the map)
}

interface Market   { soupPrice: number; supply: number; demand: number; }
interface Economy  { soupPrice, inflationRate, unemploymentRate, gini,
                     totalMoney: number; inflationHistory: number[]; } // last 20
interface PlayerPolicy { interestRate: number; /*0..20*/ taxRate: number; /*0..50*/ }
interface NewsItem { tick: number; event: string; text: string; }
interface GameState { tick: number; cats: Cat[]; market: Market;
                      economy: Economy; policy: PlayerPolicy; newsLog: NewsItem[]; }

type PolicyAction =
  | { type: 'ISSUE_CURRENCY'; amount: number }
  | { type: 'SET_INTEREST_RATE'; value: number }
  | { type: 'SET_TAX_RATE'; value: number };
```

## Economy model (`economy.ts`)

- **Price** moves toward the demand/supply ratio with negative feedback baked
  into demand (cats buy less when price is high), so the price self-stabilises.
  Per-tick change is clamped to ±40% (wide enough that a sustained demand shock
  can push inflation past +30% into hyperinflation), price clamped to [1, 9999].
- **Inflation** = % change of soup price vs the previous tick.
- **Unemployment** = share of cats whose `action === 'idle'`.
- **Gini** = standard Gini coefficient over `money` (0 = equal, 1 = unequal).
- `updateEconomy` recomputes the `Economy` snapshot each tick and appends the
  inflation rate to `inflationHistory` (kept to the last 20 points).

## Cat behaviour (`cats.ts`)

`decideCatAction(cat, market)` — a small state machine, priority order:
1. `energy <= 15` → `sleeping`
2. `hunger >= 65` and can eat (inventory>0 or money>=price) → `eating`
3. else by personality work chance (aggressive .9 / conservative .6 / lazy .3)
   and `energy > 25` → `working`, otherwise `idle`.

`updateCat(cat, market, policy)` applies metabolism then the action:
- **Policy hooks** (required): high **interest rate** makes *conservative* cats
  flip `working → idle` with probability `interestRate/40` (up to 50% at 20%).
- **working** income by job: producer sells produced soup (`+price·units`),
  trader earns a small margin, investor earns `money·interestRate%` capital
  income — so a high interest rate rewards investors. Costs energy.
- **eating** consumes inventory or buys at market price (this is demand).
- **sleeping**/**idle** restore energy.

`updateAllCats(state)`:
- runs `updateCat` for every cat, tallies market **supply** (producers/traders
  that worked) and money-sensitive **demand**;
- **tax**: subtracts `taxRate%` of each cat's *work income* into a pool, then
  redistributes the whole pool to the single poorest cat.

## Event table (`events.ts`)

`detectEvent(state)` returns the first matching event name (or `null`). Each
event has a **cooldown of 25 ticks** tracked in a module-level map so the same
event cannot fire repeatedly.

| event name (JP)   | condition                                   |
|-------------------|---------------------------------------------|
| `ハイパーインフレ` | inflationRate > 20                          |
| `デフレ不況`       | inflationRate < -15                         |
| `食料危機`         | soupPrice > 30                              |
| `大量失業`         | unemploymentRate > 40                       |
| `格差社会`         | gini > 0.6                                  |
| `好景気`           | 2 ≤ inflationRate ≤ 8 and unemployment < 20 |

## AI news (`api/news/route.ts` + `news.ts`)

`POST /api/news` body `{ eventName, economy, cats }` → `{ news: string }`.
- Model `claude-haiku-4-5-20251001`, `max_tokens: 100`.
- **System**: 猫村の速報アナウンサー。1文・40〜60字・日本語・語尾は「ニャ」。
- **User**: the event name plus the key indicators (price, inflation,
  unemployment, gini) so the line can cite a real number.
- If `ANTHROPIC_API_KEY` is unset or the call fails, the route returns a local
  templated line from `buildFallbackNews()` so the game still runs key-free.

## UI

Layout (`page.tsx`):
```
+--------------------------------------------------+
|  🐾 NekoEcon            tick: N                   |
+---------------------------+----------------------+
|                           |  EconomyDashboard    |
|       VillageMap          |  (indicators + chart)|
|   (5 cats wandering)      +----------------------+
|                           |  ControlPanel        |
+---------------------------+----------------------+
|  NewsTicker (latest 3, marquee)                  |
+--------------------------------------------------+
```
- **CatSprite**: emoji by action — 🐱 idle / 😴 sleeping / 🍲 eating / 💰 working;
  position via `left/top` % with `transition: 0.4s ease`.
- **EconomyDashboard** indicator colours: inflation >10 red / 0–10 green,
  unemployment >30 red, gini >0.6 red, price & total money black. Recharts
  line chart of the last 20 inflation points.
- **ControlPanel**: "+100CC 全員に配布" button, interest slider 0–20%,
  tax slider 0–50%, wired through `dispatch`.

## Player investment — stock market (`stocks.ts`)

The human player has a wallet (`player`: cash 1,000 CC to start, `holdings`,
`costBasis`, `hasEverInvested`) kept entirely separate from the NPC cats. Each
cat has a tradable `StockShare`:

- `base` smoothly tracks the cat's **money level** (`base += (money-base)*0.3`),
  so the price reflects 所持金 without compounding/ratcheting.
- `shock` is a temporary news multiplier that **decays toward 1** each tick.
- `price = clamp(base * shock, 10, 9999)` — the **defensive bounds** [10, 9999]
  are enforced on both `base` and `price` every tick.

`updateStocks` runs each tick (after `updateEconomy`). News linkage: a `大儲け`
headline calls `applyStockShock(catId, 1.2)` (+20% spike), a `破産` headline
`applyStockShock(catId, 0.7)` (−30% crash); both fade as `shock` decays.

`executeBuy` / `executeSell` trade **one share** per call and are **guarded**:
buy is a no-op if `cash < price`, sell is a no-op if the player holds none.
The matching UI buttons are `disabled` under the same conditions. The first
successful buy shows a one-time education popup ("投資とは企業の成長にお金を
預けること"). Unrealized P/L = `shares*price − costBasis`.

**Direct finance**: trades move money between the player and the cat. Buying
adds the paid price straight to that cat's `money` (funding its activity — the
investment virtuous cycle); selling withdraws the price from the cat's `money`,
floored at 0 (the system absorbs any shortfall so a cat's wealth never goes
negative from a sale).

## Weather (`getWeather` in `economy.ts`)

`getWeather(economy)` returns `boom | hyperinflation | depression | normal`
(priority in that order) and drives the map's atmosphere + cat behaviour:

| weather        | trigger                       | map                                   | cats            |
|----------------|-------------------------------|---------------------------------------|-----------------|
| boom           | smoothed inflation +2…+5%     | golden sky + money-confetti           | normal          |
| hyperinflation | smoothed inflation > +30%     | red/magma gradient + giant pulsing sun| move **3× fast**|
| depression     | unemployment > 80%            | grayscale + rain                      | **frozen**, shiver |
| normal         | otherwise                     | blue sky / green grass (default)      | normal          |

Inflation is smoothed over the last 5 ticks so a single transient price spike
doesn't flip the village; movement speed is applied in `useGameLoop` (3× / 0×).
Dramatic weather (hyperinflation/depression) is held for a minimum duration via
`nextWeatherState` + `WeatherState { current, lockUntil }`, where `lockUntil` is
a wall-clock `Date.now()` epoch-ms timestamp — it holds a real **30 seconds**
regardless of tick speed, so it doesn't flicker away when its trigger eases.

## Startups & bankruptcy (`companies.ts`)

Each cat has an `ambition` (0..1) and an optional `company`. `updateCompanies`
(each tick): a cat with ≥500 CC may found a venture (chance ∝ ambition) →
"起業" headline + stock 2×; a venture older than 40 ticks may go bankrupt →
"倒産" headline + stock ½×. Active ventures hire idle cats (the `hiring` flag in
`updateAllCats`/`updateCat`), lowering unemployment. Headlines are templated
(pushed straight to `newsLog`, no API).

## Strike (`strike.ts`)

`updateStrike` (each tick): a strike starts when `gini > 0.7` and ends when
`taxRate ≥ 30`, after 3 `ISSUE_CURRENCY` relief payouts, or a failsafe max
duration; a post-strike cooldown prevents instant re-triggering. While active
(`onStrike`): cats are **frozen** in place (no work/eat/metabolism — keeps the
economy bounded), the soup price is frozen (`updateEconomy({freezePrice})`),
and every stock bleeds −1%/tick (`updateStocks({onStrike})`). UI: a center
`StrikeBanner` + picketing cats (🪧).

## In-map signboards

`VillageMap` overlays live signboards (in addition to the dashboard panel):
🏦 ネコ銀行 (total money, top-left), 🍲 スープ鍋 (soup price, centre), and the
🏢 ネコウォール街 LED ticker (bottom-right) scrolling every cat's price with
▲/▼ (green/red) plus the latest headline.

## Player house & loan (`loan.ts`)

The player starts owing シロ銀行 10,000 CC (`PlayerWallet.loan`).
`applyLoanInterest` each tick draws `loan * rate% * 0.01` from cash, floored at
0 (cash never goes negative) — so raising the central-bank rate also squeezes
the player. A clickable tent (⛺) at the map's bottom-left opens a repayment
modal (`REPAY_LOAN`); paying the loan to 0 upgrades it to a house (🏡).

## Public works (`facilities.ts`)

The 公共事業 panel (`PublicWorks`) is a collapsible tray of draggable building
cards. Dragging a card onto the map fires `PLACE_FACILITY {kind,x,y}`: it spends
player cash, bumps the `FacilityState` count (which still drives all economic
effects), appends an individual `PlacedFacility {id,kind,x,y}` to
`state.placements`, and pushes a `FACILITY_NEWS` headline to the ticker (e.g.
「スープ工場完成！失業率が10%低下」). `VillageMap` renders each placement at its
dropped spot and applies a **proximity aura** to nearby cats (`catAura`, within
`AURA_RADIUS`): a soup factory turns idle cats to「はたらくニャ」, a matatabi park
to「しあわせニャ〜」, a fishing pond gives cats a 🎣 rod and「釣りするニャ」.
- 🏭 スープ工場 (5,000 CC): unemployment −10% each + extra supply (productivity)
- 🌳 マタタビ公園 (3,000 CC): raises the Gini threshold for strikes (anti-strike)
- 🎣 釣り堀 (2,000 CC): extra supply → downward (deflationary) price pressure

Cat-specific events (`events.ts`): `破産` (a cat at ≤0 CC) and `大儲け` (the
richest cat, ≥1.6× the village average) carry `catId`/`catName`, driving both
the news ticker and the stock shock. Cooldowns are keyed per `name:catId`.

## Conventions

- No `any`. `setInterval` is always cleared on unmount. All Anthropic calls live
  in `src/app/api/**` route handlers — never call the SDK from the client.
- Commands: `npm run dev`, `npx tsc --noEmit`, `npx eslint src/`, `npm run build`.
