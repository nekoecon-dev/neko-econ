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
  Per-tick change is clamped to ±20%, price clamped to [1, 9999].
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

## Conventions

- No `any`. `setInterval` is always cleared on unmount. All Anthropic calls live
  in `src/app/api/**` route handlers — never call the SDK from the client.
- Commands: `npm run dev`, `npx tsc --noEmit`, `npx eslint src/`, `npm run build`.
