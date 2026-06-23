import type {
  Cat,
  FurnitureKind,
  GameState,
  GatherItem,
  GatherKind,
  InteriorItem,
  LifeFx,
  LifeState,
  LifeTime,
  StallChoice,
  StockShare,
} from '@/types/game';
import { round2 } from './math';
import { initStock } from './stocks';

// --- Tuning -----------------------------------------------------------------
export const SOUP_NEED = 3; // mushrooms ミケ wants for a pot of soup
export const SOUP_REWARD = 100; // ニャル per soup in free play
export const STALL_WOOD = 3; // wood needed to build the DAY5 stall
export const STALL_COST = 200; // ニャル to build the DAY5 stall
export const DAY7_REPAY = 300; // ニャル たぬきち collects on DAY7

/**
 * Prepared 公共財政 learning messages — shown once the village reaches level 2
 * and the budget/tax UI unlocks. Not displayed yet (foundation only).
 */
export const PUBLIC_FINANCE_LESSONS = [
  '税金は、道や橋など、みんなが使うものに使われるニャ',
  '便利な村になると、お店がもうかって、村の税収も増えるニャ',
] as const;

// Per-day cash rewards / income.
const DAY1_REWARD = 50;
const DAY2_SOUP_REWARD = 150;
const DAY4_REWARD = 150;
const STALL_INCOME = 20; // ニャル/day 配当 once the stall opens (出資)
const LEND_DAYS = 5; // 貸付 repayment runs this many days
const LEND_PER_DAY = 44; // ニャル/day returned while repaying (44×5 = 220)
const LEND_TOTAL = LEND_DAYS * LEND_PER_DAY; // 220ニャル total returned (貸付)
const MIKE_ID = '4'; // ミケ's cat id (DAY5 親密度)
const ROAD_INCOME = 10; // extra ニャル/day once the road connects

export const FURNITURE_COST: Record<FurnitureKind, number> = {
  // DAY3 starter set (cheap so the campaign budget works out)
  lamp: 50,
  table: 55,
  bed: 60,
  planter: 45,
  // free-play extras
  chair: 60,
  rug: 100,
  plant: 50,
  statue: 200,
  mikeStatue: 0, // gift-only — not sold at たぬきち
};

export const FURNITURE_META: Record<FurnitureKind, { icon: string; name: string }> = {
  lamp: { icon: '💡', name: 'ランプ' },
  table: { icon: '🪵', name: 'テーブル' },
  bed: { icon: '🛏️', name: 'ねこベッド' },
  planter: { icon: '🌷', name: '花壇' },
  chair: { icon: '🪑', name: 'いす' },
  rug: { icon: '🟫', name: 'ラグ' },
  plant: { icon: '🪴', name: '観葉植物' },
  statue: { icon: '🗿', name: 'ねこ像' },
  mikeStatue: { icon: '🐱', name: 'ミケのありがとう像' },
};

const GATHER_META: Record<GatherKind, { icon: string; name: string }> = {
  mushroom: { icon: '🍄', name: 'きのこ' },
  fish: { icon: '🐟', name: 'さかな' },
  wood: { icon: '🪵', name: '木材' },
  flower: { icon: '🌸', name: 'はな' },
  bell: { icon: '🔔', name: '落とし物' },
};

export function gatherIcon(kind: GatherKind): string {
  return GATHER_META[kind].icon;
}
export function gatherName(kind: GatherKind): string {
  return GATHER_META[kind].name;
}

// The DAY3 furniture shop (and the extras unlocked at level 2).
export const SHOP_FURNITURE: FurnitureKind[] = ['lamp', 'table', 'bed', 'planter'];

// --- objective + story text -------------------------------------------------
const DAY_OBJECTIVE: Record<number, string> = {
  1: '🍄 きのこを3つ集めよう（マップのきのこをクリック）',
  2: '🐱 ミケに話しかけてスープを作ろう',
  3: '✨ 光っているたぬきちに話しかけよう（家具を買おう）',
  4: '🔔 タマの落とし物を見つけて、タマに渡そう',
  5: '🪵 木材3個と200ニャルで、ミケの屋台を建てよう',
  6: '🛤️ ミケの屋台とスープ鍋を道でつなごう',
  7: '💰 たぬきちに300ニャル返済しよう',
};

const DAY_INTRO: Record<number, string> = {
  2: '🐱 ミケ「昨日のきのこでスープを作るニャ！」',
  3: '🦝 たぬきち「家具店を開けたニャ。テントを飾るといいニャ」',
  4: '🐈 タマ「落とし物をしたニャ…広場のあたりの草地で落とした気がするニャ…」',
  5: '🐱 ミケ「スープ屋を開きたいけど、木材とお金が足りないニャ」',
  6: '🦝 たぬきち「道を作るにはお金がかかるニャ。今回は村からインフラ補助金30ニャルが出るニャ」',
  7: '🦝 たぬきち「そろそろテント代を少し返してほしいニャ」',
};

export function lifeObjective(life: LifeState): string {
  if (life.day > 7) return '🌳 のんびり村を育てよう（1日進めると何かが起きる）';
  if (life.dayDone) return '✅ 今日の目的達成！「次の日へ」で進もう';
  // DAY3 sub-steps: buy at たぬきち → click the tent → decorate inside.
  if (life.day === 3) {
    if (life.ownedFurniture.length === 0 && life.interior.length === 0) {
      return '✨ 光っているたぬきちに話しかけて家具を買おう';
    }
    if (life.sceneMode === 'interior') return '🪑 家具を配置して部屋を飾ろう';
    return '🏠 テントをクリックして中に入ろう';
  }
  return DAY_OBJECTIVE[life.day] ?? '🌳 のんびり村を育てよう';
}

// --- item placement ---------------------------------------------------------
// Obstacles to keep gatherables (and especially the lost item) clear of, in
// map % with a keep-out radius. Covers the central pot, the player tent,
// たぬきち + his shop, the cottages and the pond (trees sit near the edges,
// outside the spawn band below).
const OBSTACLES: { x: number; y: number; r: number }[] = [
  { x: 50, y: 50, r: 13 }, // 中央スープ鍋／広場
  { x: 27.5, y: 72.5, r: 11 }, // プレイヤーのテント
  { x: 73, y: 51, r: 7 }, // たぬきち
  { x: 81, y: 46, r: 10 }, // たぬきち商店
  { x: 22.5, y: 82.5, r: 11 }, // 赤い屋根の家
  { x: 82.5, y: 25, r: 11 }, // 家
  { x: 75, y: 90, r: 11 }, // 家
  { x: 25, y: 17.5, r: 11 }, // 池
];

function clearOfObstacles(x: number, y: number): boolean {
  return OBSTACLES.every((o) => Math.hypot(x - o.x, y - o.y) > o.r);
}

/** An open spot in the central-plaza grass, clear of buildings/pond/trees. */
function scatterSpot(): { x: number; y: number } {
  for (let tries = 0; tries < 60; tries++) {
    const x = 24 + Math.random() * 52;
    const y = 24 + Math.random() * 52;
    if (clearOfObstacles(x, y)) return { x, y };
  }
  return { x: 40, y: 40 }; // open grass fallback
}

function makeItem(seq: number, kind: GatherKind): GatherItem {
  let spot = scatterSpot();
  if (kind === 'fish') spot = { x: 30 + Math.random() * 6, y: 24 + Math.random() * 6 };
  if (kind === 'wood') spot = { x: 60 + Math.random() * 8, y: 30 + Math.random() * 8 };
  return { id: `item-${seq}`, kind, x: spot.x, y: spot.y };
}

// --- initial states ---------------------------------------------------------
export function lifeInactive(): LifeState {
  return {
    active: false,
    playerName: '',
    day: 1,
    dayDone: false,
    reward: 0,
    time: 'morning',
    weather: 'sunny',
    level: 1,
    liveliness: 0,
    festivalPhase: 'none',
    sale: false,
    playerX: 50,
    playerY: 50,
    inventory: { mushroom: 0, fish: 0, wood: 0, flower: 0, bell: 0 },
    items: [],
    furniture: [],
    ownedFurniture: [],
    interior: [],
    sceneMode: 'village',
    visitors: [],
    soupsMade: 0,
    shopOpen: false,
    shopUnlocked: false,
    roadDone: false,
    roadBudget: 0,
    infraExplained: false,
    dailyIncome: 0,
    lendDays: 0,
    loanUnlocked: false,
    rescueUsed: false,
    finance: {
      villageBudget: 0,
      taxRevenuePerDay: 0,
      infrastructureLevel: 0,
      roadMaintenanceCost: 0,
      businessSalesBoostFromInfrastructure: 0,
    },
    intimacy: {},
    intimacyExplained: false,
    hasLostItem: false,
    hasMoved: false,
    day1IntroDone: false,
    hasExplainedNyar: false,
    trust: 0,
    hintArrow: false,
    event: null,
    notice: null,
    fx: { id: 0, kind: null, x: 50, y: 50 },
    seq: 0,
  };
}

/** DAY1: a few big mushrooms to find (the welcome shows once the name is set). */
export function lifeInitial(): LifeState {
  const base = lifeInactive();
  let seq = 0;
  const kinds: GatherKind[] = ['mushroom', 'mushroom', 'mushroom', 'mushroom', 'wood'];
  const items = kinds.map((k) => makeItem(seq++, k));
  // Start just in front of the player's tent so DAY1 begins "stepping out of home".
  return { ...base, active: true, items, seq, playerX: 33, playerY: 66 };
}

/** Confirm the hero's name (defaults to ニャオ), then show たぬきち's welcome. */
export function lifeSetName(state: GameState, name: string): GameState {
  const playerName = name.trim().slice(0, 8) || 'ニャオ';
  // The welcome is now the DAY1 opening conversation overlay (see LifeOverlay),
  // so no notice is set here.
  return { ...state, life: { ...state.life, playerName } };
}

// --- helpers ----------------------------------------------------------------
function fire(life: LifeState, kind: LifeFx['kind'], x: number, y: number): LifeState {
  const seq = life.seq + 1;
  return { ...life, seq, fx: { id: seq, kind, x, y } };
}

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
    y: 40,
    ambition: 0.8,
    company: null,
  };
  return { cat, stock: initStock(cat.money) };
}

// --- reducers ---------------------------------------------------------------
export function lifeMove(state: GameState, x: number, y: number): GameState {
  return { ...state, life: { ...state.life, playerX: x, playerY: y, hasMoved: true } };
}

export function lifeGather(state: GameState, id: string): GameState {
  const life = state.life;
  const item = life.items.find((i) => i.id === id);
  if (!item) return state;
  const items = life.items.filter((i) => i.id !== id);

  // タマ's lost item (DAY4) is carried, not stashed in the inventory.
  if (item.kind === 'bell') {
    return {
      ...state,
      life: {
        ...life,
        items,
        hasLostItem: true,
        hintArrow: false,
        playerX: item.x,
        playerY: item.y,
      },
    };
  }

  const inventory = { ...life.inventory, [item.kind]: life.inventory[item.kind] + 1 };
  let next: LifeState = { ...life, items, inventory, playerX: item.x, playerY: item.y };
  let cash = state.player.cash;

  // DAY1 completes once 3 mushrooms are in the basket.
  if (life.day === 1 && !life.dayDone && inventory.mushroom >= SOUP_NEED) {
    cash = round2(cash + DAY1_REWARD);
    // First ニャル ever → たぬきち explains what the money is (once).
    const firstNyar = !life.hasExplainedNyar;
    next = {
      ...next,
      dayDone: true,
      reward: DAY1_REWARD,
      hasExplainedNyar: true,
      notice: firstNyar
        ? `🦝 たぬきち「それがニャルニャ。NekoEcon村で使えるお金ニャ」\n\n家具を買ったり、道を作ったり、ローンを返したりするときに使うニャ。\n\n💰 ニャル＝NekoEcon村のお金\n・集める / 売る / 手伝うことで増える\n・使うと、暮らしや村が変わる`
        : `🐱 ミケ「上手にきのこを集めたニャ！おれいに +${DAY1_REWARD}ニャル ニャ」`,
    };
  }

  return { ...state, player: { ...state.player, cash }, life: next };
}

/** Finish the DAY1 opening conversation (たぬきち導入). */
export function lifeDay1IntroDone(state: GameState): GameState {
  return { ...state, life: { ...state.life, day1IntroDone: true } };
}

export function lifeGiveSoup(state: GameState): GameState {
  const life = state.life;
  if (life.inventory.mushroom < SOUP_NEED) return state;
  const inventory = { ...life.inventory, mushroom: life.inventory.mushroom - SOUP_NEED };
  const reward = life.day === 2 ? DAY2_SOUP_REWARD : SOUP_REWARD;
  const dayDone = life.day === 2 ? true : life.dayDone;
  return {
    ...state,
    player: { ...state.player, cash: round2(state.player.cash + reward) },
    life: fire(
      {
        ...life,
        inventory,
        soupsMade: life.soupsMade + 1,
        dayDone,
        reward: life.day === 2 ? reward : life.reward,
        notice: `🍲 スープ完成！猫たちが集まってきたニャ +${reward}ニャル`,
      },
      'soup',
      50,
      50,
    ),
  };
}

export function lifeGiveLost(state: GameState): GameState {
  const life = state.life;
  if (!life.hasLostItem) return state;
  const inventory = { ...life.inventory, flower: life.inventory.flower + 1 };
  const tamaLevel = Math.min(5, (life.intimacy['3'] ?? 1) + 1); // タマ id '3'
  const explain = life.intimacyExplained
    ? ''
    : '\n\n💡 親密度とは、猫たちとの仲良し度ニャ。上がると新しいお願い・プレゼント・特別な会話が増えるニャ。';
  return {
    ...state,
    player: { ...state.player, cash: round2(state.player.cash + DAY4_REWARD) },
    life: fire(
      {
        ...life,
        hasLostItem: false,
        inventory,
        intimacy: { ...life.intimacy, '3': tamaLevel },
        intimacyExplained: true,
        dayDone: life.day === 4 ? true : life.dayDone,
        reward: life.day === 4 ? DAY4_REWARD : life.reward,
        notice: `🐈 タマ「ありがとうニャ！珍しいお花と +${DAY4_REWARD}ニャル をあげるニャ🌸」\n\n💗 タマとの親密度が上がった！（Lv ${tamaLevel}）${explain}`,
      },
      'soup',
      60,
      58,
    ),
  };
}

/** Buy a piece of furniture — it goes into the owned list, to place inside the tent. */
export function lifeBuyFurniture(state: GameState, kind: FurnitureKind): GameState {
  const life = state.life;
  if (!life.shopUnlocked) return state;
  if (!SHOP_FURNITURE.includes(kind) && life.level < 2) return state; // extras need level 2
  const cost = Math.round(FURNITURE_COST[kind] * (life.sale ? 0.5 : 1));
  if (state.player.cash < cost) return state;
  return {
    ...state,
    player: { ...state.player, cash: round2(state.player.cash - cost) },
    life: { ...life, ownedFurniture: [...life.ownedFurniture, kind] },
  };
}

/** Enter the tent-interior screen (sceneMode → interior). */
export function lifeEnterTent(state: GameState): GameState {
  return { ...state, life: { ...state.life, sceneMode: 'interior' } };
}

/**
 * Leave the tent (sceneMode → village). DAY3 is already cleared the moment a
 * piece is placed (see lifePlaceInterior); stepping back outside just shows the
 * one-time celebration the first time the player returns after decorating.
 */
export function lifeExitTent(state: GameState): GameState {
  const life = state.life;
  if (life.day === 3 && life.dayDone && life.interior.length > 0 && life.notice === null) {
    return {
      ...state,
      life: {
        ...life,
        sceneMode: 'village',
        reward: 0,
        notice:
          '🛋️ おうちが少し楽しくなったニャ！\n\n集めて、売って、手に入れたニャルで家具を買えたニャ。お金は貯めるだけじゃなく、暮らしを良くするためにも使えるニャ。',
      },
    };
  }
  return { ...state, life: { ...life, sceneMode: 'village' } };
}

const occupied = (interior: InteriorItem[], gx: number, gy: number, exceptId?: string): boolean =>
  interior.some((it) => it.gx === gx && it.gy === gy && it.id !== exceptId);

/** Place an owned piece of furniture on the room grid (persists in `interior`). */
export function lifePlaceInterior(
  state: GameState,
  kind: FurnitureKind,
  gx: number,
  gy: number,
  rot: number,
): GameState {
  const life = state.life;
  const idx = life.ownedFurniture.indexOf(kind);
  if (idx < 0 || occupied(life.interior, gx, gy)) return state;
  const ownedFurniture = life.ownedFurniture.filter((_, i) => i !== idx);
  const piece: InteriorItem = { id: `furn-${life.seq + 1}`, kind, gx, gy, rot };
  // DAY3 clears as soon as the player actually places a piece of furniture.
  const day3Clear = life.day === 3 && !life.dayDone;
  // ミケのありがとう像 raises 村のにぎわい while it is on display (reverted on しまう).
  const vibrancy = kind === 'mikeStatue' ? 1 : 0;
  return {
    ...state,
    life: {
      ...life,
      seq: life.seq + 1,
      ownedFurniture,
      interior: [...life.interior, piece],
      liveliness: life.liveliness + vibrancy,
      dayDone: day3Clear ? true : life.dayDone,
      reward: day3Clear ? 0 : life.reward,
    },
  };
}

/** Move a placed piece to an empty grid cell. */
export function lifeMoveInterior(state: GameState, id: string, gx: number, gy: number): GameState {
  const life = state.life;
  if (occupied(life.interior, gx, gy, id)) return state;
  return {
    ...state,
    life: {
      ...life,
      interior: life.interior.map((it) => (it.id === id ? { ...it, gx, gy } : it)),
    },
  };
}

/** Rotate a placed piece 90°. */
export function lifeRotateInterior(state: GameState, id: string): GameState {
  const life = state.life;
  return {
    ...state,
    life: {
      ...life,
      interior: life.interior.map((it) => (it.id === id ? { ...it, rot: (it.rot + 90) % 360 } : it)),
    },
  };
}

/** 「しまう」: remove a placed piece — it returns to the owned list. */
export function lifeRemoveInterior(state: GameState, id: string): GameState {
  const life = state.life;
  const piece = life.interior.find((it) => it.id === id);
  if (!piece) return state;
  const vibrancy = piece.kind === 'mikeStatue' ? 1 : 0; // reverse the display bonus
  return {
    ...state,
    life: {
      ...life,
      interior: life.interior.filter((it) => it.id !== id),
      ownedFurniture: [...life.ownedFurniture, piece.kind],
      liveliness: Math.max(0, life.liveliness - vibrancy),
    },
  };
}

/** DAY4 「ヒントを見る」: reveal a temporary arrow over the lost item. */
export function lifeShowHint(state: GameState): GameState {
  return { ...state, life: { ...state.life, hintArrow: true } };
}

/**
 * DAY5: fund ミケの屋台 with one of three financing styles, teaching
 * 出資 (equity) / 貸付 (loan) / 贈与 (gift). All three cost 200ニャル + 3 wood
 * and build the stall; they differ in how the money comes back and how much
 * ミケとの親密度 rises.
 */
export function lifeBuildStall(state: GameState, choice: StallChoice): GameState {
  const life = state.life;
  if (life.shopOpen) return state;
  if (life.inventory.wood < STALL_WOOD || state.player.cash < STALL_COST) return state;
  const inventory = { ...life.inventory, wood: life.inventory.wood - STALL_WOOD };
  const shop = { id: 'life-soup-shop', kind: 'soupFactory' as const, x: SHOP_POS.x, y: SHOP_POS.y };

  // Choice-specific economy / relationship / reward item.
  let dailyIncome = life.dailyIncome;
  let lendDays = life.lendDays;
  let ownedFurniture = life.ownedFurniture;
  let intimacyDelta: number;
  let detail: string;
  if (choice === 'invest') {
    dailyIncome = life.dailyIncome + STALL_INCOME;
    intimacyDelta = 2;
    detail = `出資したニャ！これから毎日+${STALL_INCOME}ニャルの配当がもらえるニャ。出資とは、お店の成長を応援して、うまくいったら利益の一部を受け取ることニャ。`;
  } else if (choice === 'lend') {
    lendDays = LEND_DAYS;
    intimacyDelta = 1;
    detail = `貸したニャ！${LEND_DAYS}日かけて合計${LEND_TOTAL}ニャル（毎日+${LEND_PER_DAY}）返してもらうニャ。貸付とは、お金を貸して、あとで少し多く返してもらうことニャ。`;
  } else {
    ownedFurniture = [...life.ownedFurniture, 'mikeStatue']; // お礼「ミケのありがとう像」
    intimacyDelta = 4;
    detail =
      'プレゼントしたニャ！お金は戻らないけど、お礼に「ミケのありがとう像🐱」をもらったニャ。部屋や外に飾ると村のにぎわいが上がるニャ。インベントリの家具から配置できるニャ。プレゼントは、お金は戻らないけど、仲良し度が大きく上がるニャ。';
  }
  const intimacy = {
    ...life.intimacy,
    [MIKE_ID]: Math.min(5, (life.intimacy[MIKE_ID] ?? 1) + intimacyDelta),
  };

  return {
    ...state,
    player: { ...state.player, cash: round2(state.player.cash - STALL_COST) },
    facilities: { ...state.facilities, soupFactory: state.facilities.soupFactory + 1 },
    placements: [...state.placements, shop],
    // ミケ & タマ work at the new stall (drives the DAY5 建設演出 in Village3D).
    cats: state.cats.map((c) =>
      c.id === MIKE_ID
        ? { ...c, action: 'working', x: shop.x - 4, y: shop.y }
        : c.id === '3'
          ? { ...c, action: 'working', x: shop.x + 4, y: shop.y }
          : c,
    ),
    life: fire(
      {
        ...life,
        inventory,
        shopOpen: true,
        dailyIncome,
        lendDays,
        ownedFurniture,
        intimacy,
        dayDone: life.day === 5 ? true : life.dayDone,
        reward: life.day === 5 ? 0 : life.reward,
        notice: `🎉 ミケの屋台が完成！${detail}`,
      },
      'construct',
      shop.x,
      shop.y,
    ),
  };
}

export function lifeConnectRoad(state: GameState): GameState {
  const life = state.life;
  if (life.roadDone) return state;
  // Cobblestones from the central pot (grid 0,0) toward the stall.
  const fresh = [
    { gx: 0, gz: 1 },
    { gx: -1, gz: 1 },
    { gx: -1, gz: 2 },
    { gx: -2, gz: 2 },
  ];
  const existing = new Set(state.roads.map((r) => `${r.gx},${r.gz}`));
  const roads = [...state.roads, ...fresh.filter((r) => !existing.has(`${r.gx},${r.gz}`))];
  return {
    ...state,
    roads,
    life: {
      ...life,
      roadDone: true,
      dailyIncome: life.dailyIncome + ROAD_INCOME,
      dayDone: life.day === 6 ? true : life.dayDone,
      reward: life.day === 6 ? 0 : life.reward,
      notice: `🛤️ 道が開通！猫の足が速くなり、屋台の売上も増えたニャ（毎日+${ROAD_INCOME}ニャル）`,
    },
  };
}

export const LIFE_ROAD_COST = 5; // ニャル per 土の道 tile in life mode (DAY6)
export const ROAD_SUBSIDY = 30; // 村のインフラ補助金 granted at the start of DAY6

// ミケの屋台 sits at map (50,70) → world (0,8) → grid (0,4), a good 4 tiles
// south of the スープ鍋 (central pot, grid 0,0), so a real road must be laid to
// link them. (Grid derived from mapToWorld/TILE; hardcoded so the engine stays
// free of the THREE-importing builders module.)
export const SHOP_POS = { x: 50, y: 70 };
const SHOP_GRID = { gx: 0, gz: 4 };
const POT_GRID = { gx: 0, gz: 0 };
export const MIN_ROAD_TILES = 4; // 屋台↔鍋 must be a real path, not a couple of planks

type Cell = { gx: number; gz: number };
const cheb = (a: Cell, b: Cell) => Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gz - b.gz));

/**
 * BFS over the laid road tiles: is there a connected run of road (8-neighbour)
 * that touches both the 屋台 entrance and the 鍋 entrance (Chebyshev ≤ 1)?
 */
export function roadsConnect(roads: Cell[], from: Cell, to: Cell): boolean {
  const set = new Set(roads.map((r) => `${r.gx},${r.gz}`));
  const starts = roads.filter((r) => cheb(r, from) <= 1);
  if (starts.length === 0) return false;
  const seen = new Set<string>();
  const queue: Cell[] = [];
  for (const s of starts) {
    const k = `${s.gx},${s.gz}`;
    if (!seen.has(k)) {
      seen.add(k);
      queue.push(s);
    }
  }
  while (queue.length > 0) {
    const cur = queue.shift() as Cell;
    if (cheb(cur, to) <= 1) return true;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const nk = `${cur.gx + dx},${cur.gz + dz}`;
        if (set.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          queue.push({ gx: cur.gx + dx, gz: cur.gz + dz });
        }
      }
    }
  }
  return false;
}

/** Are the 屋台 and スープ鍋 currently joined by a continuous road? */
export function lifeRoadConnected(roads: Cell[]): boolean {
  return roadsConnect(roads, SHOP_GRID, POT_GRID);
}

/**
 * DAY6 mission: 「ミケの屋台とスープ鍋を道でつなごう」. Clears once a *continuous*
 * road actually links the 屋台 and the 鍋 (BFS, not a loose tile count). On clear
 * it speeds the cats up (Village3D via roadDone), lifts the 屋台's daily takings
 * by ROAD_INCOME, and raises the village's にぎわい — an infrastructure investment.
 * (commit 2 layers the arrival 演出 / bonuses on top.)
 */
// Where the customers queue in front of ミケの屋台 once the road connects (map %).
// Village3D reads the same spots to float the speech bubbles over the cats.
export const SHOP_QUEUE: ReadonlyArray<{ x: number; y: number }> = [
  { x: 46, y: 74 },
  { x: 54, y: 74 },
  { x: 50, y: 79 },
];
const LOGISTICS_BONUS = 80; // 物流改善ボーナス paid once on connecting the road
const ROAD_DIVIDEND = 20; // extra ニャル/day added on connecting (on top of ROAD_INCOME)

function judgeDay6Road(state: GameState): GameState {
  const life = state.life;
  if (life.day !== 6 || life.roadDone) return state;
  // Must be a continuous road AND a real path (≥ MIN_ROAD_TILES), not 2 planks.
  if (!lifeRoadConnected(state.roads) || state.roads.length < MIN_ROAD_TILES) return state;
  // ミケ walks the new road over to the スープ鍋; up to 3 other cats line up at
  // the 屋台 (Village3D plays the speech bubbles + 売上/ボーナス popups).
  let qi = 0;
  const cats = state.cats.map((c) => {
    if (c.id === '4') return { ...c, action: 'working' as const, x: 50, y: 54 }; // ミケ → 鍋
    if (qi < SHOP_QUEUE.length) {
      const sp = SHOP_QUEUE[qi++];
      return { ...c, action: 'idle' as const, x: sp.x, y: sp.y };
    }
    return c;
  });
  return {
    ...state,
    cats,
    player: { ...state.player, cash: round2(state.player.cash + LOGISTICS_BONUS) }, // 物流改善ボーナス
    life: {
      ...life,
      roadDone: true,
      dayDone: true,
      reward: 0,
      dailyIncome: life.dailyIncome + ROAD_INCOME + ROAD_DIVIDEND, // 屋台の毎日配当 +10 +20
      liveliness: life.liveliness + 1, // 村のにぎわい +1
      notice: null, // delayed — LifeOverlay shows it after the arrival 演出 plays
    },
  };
}

/** DAY6: reveal the explanation modal once the arrival 演出 has played a beat. */
export function lifeRoadNotice(state: GameState): GameState {
  const life = state.life;
  if (!(life.day === 6 && life.roadDone && life.dayDone && life.notice === null)) return state;
  return {
    ...state,
    life: {
      ...life,
      notice: `🛤️ 道がつながって、ミケの屋台に猫が来やすくなったニャ。便利になると、商売も伸びるニャ！\n\n💰 物流改善ボーナス +${LOGISTICS_BONUS}ニャル ／ 毎日配当 +${ROAD_INCOME + ROAD_DIVIDEND}ニャル ／ にぎわい+1`,
    },
  };
}

// --- DAY7 詰み防止：救済イベント -------------------------------------------
const RESCUE_WAGE = 100; // ニャル earned by 「もう1日働く」
const RESCUE_WAIT_PENALTY = 50; // added to the loan when deferring repayment

/** DAY7 rescue ①「もう1日働いてから返す」: forage more + earn a day's wage. */
export function lifeRescueWork(state: GameState): GameState {
  const life = state.life;
  let seq = life.seq;
  const fresh = (['fish', 'mushroom', 'fish', 'flower', 'mushroom', 'wood'] as GatherKind[]).map(
    (k) => makeItem(seq++, k),
  );
  return {
    ...state,
    player: { ...state.player, cash: round2(state.player.cash + RESCUE_WAGE) },
    life: {
      ...life,
      seq,
      items: [...life.items, ...fresh],
      notice: `🌅 もう1日がんばって働いたニャ！採集アイテムが増えて、お駄賃${RESCUE_WAGE}ニャルももらったニャ。集めて売れば返済できるニャ`,
    },
  };
}

/** DAY7 rescue ②「ミケから売上を前借りする」: only if the 屋台 is open; tops cash up to the repayment. */
export function lifeRescueBorrow(state: GameState): GameState {
  const life = state.life;
  if (!life.shopOpen || state.player.cash >= DAY7_REPAY) return state;
  return {
    ...state,
    player: { ...state.player, cash: DAY7_REPAY },
    life: {
      ...life,
      notice: `🐱 ミケ「屋台の売上から前借りしていいニャ！」\n\n不足分を補って${DAY7_REPAY}ニャルになったニャ。たぬきちに返済できるニャ`,
    },
  };
}

/** DAY7 rescue ③「返済を少し待ってもらう」: once only — defer (loan +50) and move on. */
export function lifeRescueWait(state: GameState): GameState {
  const life = state.life;
  if (life.rescueUsed) return state;
  return {
    ...state,
    player: { ...state.player, loan: round2(state.player.loan + RESCUE_WAIT_PENALTY) },
    life: {
      ...life,
      rescueUsed: true,
      dayDone: true,
      reward: 0,
      loanUnlocked: true,
      notice: `🦝 たぬきち「今回は待つニャ。そのかわり次の返済は+${RESCUE_WAIT_PENALTY}ニャルニャ」\n\n返済をあとに回したニャ。テント代はあとでゆっくり返せばいいニャ`,
    },
  };
}

/**
 * Lay one 土の道 tile (5ニャル). Pays from the 村のインフラ補助金 (roadBudget)
 * first, then from personal cash. No-op if both are exhausted, or if paved.
 */
export function lifeLayRoad(state: GameState, gx: number, gz: number): GameState {
  const life = state.life;
  const fromBudget = life.roadBudget >= LIFE_ROAD_COST;
  if (!fromBudget && state.player.cash < LIFE_ROAD_COST) return state;
  const key = `${gx},${gz}`;
  if (state.roads.some((r) => `${r.gx},${r.gz}` === key)) return state;
  const nextLife = { ...life };
  let cash = state.player.cash;
  if (fromBudget) nextLife.roadBudget = life.roadBudget - LIFE_ROAD_COST;
  else cash = round2(cash - LIFE_ROAD_COST);
  // First road of DAY6 teaches what 公共インフラ is (once).
  if (life.day === 6 && !life.infraExplained) {
    nextLife.infraExplained = true;
    nextLife.notice =
      '💡 公共インフラとは、みんなが使う道や橋のことニャ。道ができると村の商売が元気になるニャ';
  }
  return judgeDay6Road({
    ...state,
    player: { ...state.player, cash },
    roads: [...state.roads, { gx, gz }],
    life: nextLife,
  });
}

/** Remove a 土の道 tile (no refund). */
export function lifeRemoveRoad(state: GameState, gx: number, gz: number): GameState {
  const key = `${gx},${gz}`;
  const roads = state.roads.filter((r) => `${r.gx},${r.gz}` !== key);
  if (roads.length === state.roads.length) return state;
  return { ...state, roads };
}

/**
 * DAY7: repay たぬきち, then kick off the ending cinematic. The 村レベル2
 * celebration plays in beats (see {@link FestivalPhase}) so the fireworks are
 * seen *before* the modal appears — here we only fire the fireworks, gather the
 * cats around the pot, and set `festivalPhase: 'fireworks'` (notice stays null
 * so no modal yet). LifeOverlay advances the beats on a timer.
 */
export function lifeRepay(state: GameState): GameState {
  const life = state.life;
  if (state.player.cash < DAY7_REPAY) return state;
  const pay = Math.min(DAY7_REPAY, state.player.loan);
  // 新区画の採集アイテムをまく
  let seq = life.seq;
  const newItems = (['fish', 'fish', 'flower', 'mushroom', 'wood'] as GatherKind[]).map((k) =>
    makeItem(seq++, k),
  );
  // 猫たちがスープ鍋（map 50,50）の周りに集まる。
  const n = Math.max(1, state.cats.length);
  const gathered = state.cats.map((c, i) => {
    const a = (i / n) * Math.PI * 2;
    return { ...c, action: 'idle' as const, x: 50 + Math.cos(a) * 11, y: 50 + Math.sin(a) * 11 };
  });
  return {
    ...state,
    player: {
      ...state.player,
      cash: round2(state.player.cash - DAY7_REPAY),
      loan: round2(state.player.loan - pay),
    },
    cats: gathered,
    life: fire(
      {
        ...life,
        seq,
        items: [...life.items, ...newItems],
        level: 2,
        loanUnlocked: true,
        dayDone: true,
        reward: 0,
        festivalPhase: 'fireworks',
        notice: null, // delayed — the modal appears at the 'level2' beat
      },
      'fireworks',
      50,
      50,
    ),
  };
}

/** Advance the DAY7 ending cinematic one beat (fired on a timer / button). */
export function lifeFestivalNext(state: GameState): GameState {
  const life = state.life;
  if (life.festivalPhase === 'fireworks') {
    // Fireworks have shown for a beat → reveal the 村レベル2 modal.
    return {
      ...state,
      life: { ...life, festivalPhase: 'level2', notice: '🎆 NekoEcon村 レベル2！' },
    };
  }
  if (life.festivalPhase === 'level2') {
    // Modal dismissed → 新住民シロ moves in (entrance polish lives in Village3D).
    const { cat: shiro, stock } = makeShiro();
    const has = state.cats.some((c) => c.name === 'シロ');
    return {
      ...state,
      cats: has ? state.cats : [...state.cats, shiro],
      stocks: state.stocks['1'] ? state.stocks : { ...state.stocks, [shiro.id]: stock },
      life: fire({ ...life, festivalPhase: 'shiro', notice: null }, 'fireworks', shiro.x, shiro.y),
    };
  }
  if (life.festivalPhase === 'shiro') {
    return { ...state, life: { ...life, festivalPhase: 'done' } };
  }
  return state;
}

export function lifeDismissNotice(state: GameState): GameState {
  return { ...state, life: { ...state.life, notice: null } };
}

const NEXT_TIME: Record<LifeTime, LifeTime> = { morning: 'day', day: 'evening', evening: 'morning' };

/** Spawn the gatherables / set the story beat for the day just entered. */
function setupDay(life: LifeState, day: number): LifeState {
  let seq = life.seq;
  let items = life.items;
  const shopUnlocked = life.shopUnlocked || day >= 3; // たぬきちの家具店 opens on DAY3
  if (day === 4) {
    // Dropped in the open central grass — never inside a building / tree / pond.
    const spot = scatterSpot();
    items = [...items, { id: `item-${seq++}`, kind: 'bell', x: spot.x, y: spot.y }];
  } else if (day === 5) {
    const wood = [0, 1, 2].map(() => makeItem(seq++, 'wood'));
    items = [...items, ...wood];
  }
  // DAY6: hand out the 村のインフラ補助金 so the first roads are "village funded".
  const roadBudget = day === 6 ? life.roadBudget + ROAD_SUBSIDY : life.roadBudget;
  return { ...life, seq, items, shopUnlocked, roadBudget, notice: DAY_INTRO[day] ?? life.notice };
}

/**
 * Advance one day. During the DAY1–7 campaign this is gated until the day's
 * objective is done; it then pays daily income, fires a random *visible* event,
 * and sets up the next day's story beat. (Event variety lives in commit 6.)
 */
export function lifeAdvanceDay(state: GameState): GameState {
  const life = state.life;
  if (life.day <= 7 && !life.dayDone) return state; // finish today first

  const day = life.day + 1;
  // 貸付 (DAY5「貸す」): ミケ repays LEND_PER_DAY each day until lendDays hits 0.
  const lendPay = life.lendDays > 0 ? LEND_PER_DAY : 0;
  const lendDays = Math.max(0, life.lendDays - 1);
  const cash = round2(state.player.cash + life.dailyIncome + lendPay);

  // Wake タマ from any previous nap / chat so each day's event reads cleanly.
  let cats = state.cats.map((c) =>
    c.id === '3' ? { ...c, action: 'idle' as const, x: 60, y: 58 } : c,
  );

  let next: LifeState = {
    ...life,
    day,
    dayDone: false,
    lendDays,
    festivalPhase: 'none', // any DAY7 cinematic ends once we move on
    time: NEXT_TIME[life.time],
    sale: false,
    event: null,
    hintArrow: false,
  };
  let seq = next.seq;
  const addItem = (k: GatherKind) => {
    next = { ...next, items: [...next.items, makeItem(seq++, k)] };
  };
  const addVisitor = (x: number, y: number) => {
    next = { ...next, visitors: [...next.visitors, { id: `vis-${seq++}`, name: 'たびねこ', x, y }] };
  };

  // One guaranteed *visible* ambient change every day (never a number-only tweak).
  const roll = Math.floor(Math.random() * 8);
  switch (roll) {
    case 0: // 天気変化（空が変わる）
      next = { ...next, weather: life.weather === 'sunny' ? 'rainy' : 'sunny' };
      next.event = next.weather === 'rainy' ? '☔ 雨が降ってきたニャ' : '☀️ いい天気になったニャ';
      break;
    case 1: // 新しいきのこ・花が生える
      addItem('mushroom');
      addItem(Math.random() < 0.5 ? 'flower' : 'fish');
      next.event = '🍄 新しいきのこや花が生えてきたニャ';
      break;
    case 2: // 猫同士の会話（タマがミケのそばへ歩いていく）
      cats = cats.map((c) => (c.id === '3' ? { ...c, x: 45, y: 57 } : c));
      next.event = '💬 ミケとタマがおしゃべりを始めたニャ';
      break;
    case 3: // 来訪者猫が現れる
      addVisitor(32 + Math.random() * 30, 30 + Math.random() * 28);
      next.event = '🧳 来訪者ねこが村にやってきたニャ';
      break;
    case 4: // ミケの屋台に行列（猫が並ぶ）
      addVisitor(34, 66);
      addVisitor(32, 70);
      next.event = next.shopOpen
        ? '🍲 ミケの屋台に猫の行列ができたニャ'
        : '🐱 屋台を待ちきれない猫が集まってきたニャ';
      break;
    case 5: // タマが昼寝する（ごろん＋💤）
      cats = cats.map((c) => (c.id === '3' ? { ...c, action: 'sleeping' as const } : c));
      next.event = '😴 タマが昼寝を始めたニャ';
      break;
    case 6: // 落とし物イベント（🔔がマップに出現）
      next = { ...next, items: [...next.items, { id: `item-${seq++}`, kind: 'bell', ...scatterSpot() }] };
      next.event = '🔔 だれかの落とし物が落ちているニャ';
      break;
    default: // たぬきちセール（家具半額＋お店に品が増える）
      next = { ...next, sale: true };
      addItem('wood');
      next.event = '🏷️ たぬきちが家具セールを始めたニャ';
      break;
  }

  next = setupDay({ ...next, seq }, day);
  return { ...state, cats, player: { ...state.player, cash }, life: next };
}
