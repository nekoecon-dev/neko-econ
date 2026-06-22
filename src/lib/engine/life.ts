import type {
  Cat,
  FurnitureKind,
  GameState,
  GatherItem,
  GatherKind,
  LifeFx,
  LifeState,
  LifeTime,
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

// Per-day cash rewards / income.
const DAY1_REWARD = 50;
const DAY2_SOUP_REWARD = 150;
const DAY4_REWARD = 150;
const STALL_INCOME = 20; // ニャル/day once the stall opens
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
  4: '🐈 タマ「落とし物をしたニャ…赤い屋根のおうちの近くで落とした気がするニャ…」',
  5: '🐱 ミケ「スープ屋を開きたいけど、木材とお金が足りないニャ」',
  6: '🐱 ミケ「屋台とスープ鍋を道でつなぐと、もっと売れるニャ」',
  7: '🦝 たぬきち「そろそろテント代を少し返してほしいニャ」',
};

export function lifeObjective(life: LifeState): string {
  if (life.day > 7) return '🌳 のんびり村を育てよう（1日進めると何かが起きる）';
  if (life.dayDone) return '✅ 今日の目的達成！「次の日へ」で進もう';
  // DAY3 sub-steps: buy at たぬきち → step into the tent → decorate.
  if (life.day === 3) {
    if (life.ownedFurniture.length > 0) return '🏠 テントをクリックして入り、家具を飾ろう';
    return '✨ 光っているたぬきちに話しかけて家具を買おう';
  }
  return DAY_OBJECTIVE[life.day] ?? '🌳 のんびり村を育てよう';
}

// --- item placement ---------------------------------------------------------
const PLAZA = { x0: 40, x1: 60, y0: 40, y1: 60 };

/** A random spot in the (zoomed-in) central area, clear of the plaza. */
function scatterSpot(): { x: number; y: number } {
  for (let tries = 0; tries < 12; tries++) {
    const x = 26 + Math.random() * 48;
    const y = 26 + Math.random() * 44;
    if (x > PLAZA.x0 && x < PLAZA.x1 && y > PLAZA.y0 && y < PLAZA.y1) continue;
    return { x, y };
  }
  return { x: 30, y: 30 };
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
    time: 'morning',
    weather: 'sunny',
    level: 1,
    sale: false,
    playerX: 50,
    playerY: 50,
    inventory: { mushroom: 0, fish: 0, wood: 0, flower: 0, bell: 0 },
    items: [],
    furniture: [],
    ownedFurniture: [],
    interior: [],
    inside: false,
    visitors: [],
    soupsMade: 0,
    shopOpen: false,
    shopUnlocked: false,
    roadDone: false,
    dailyIncome: 0,
    loanUnlocked: false,
    tamaIntimacy: 0,
    hasLostItem: false,
    hasMoved: false,
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
  return {
    ...state,
    life: {
      ...state.life,
      playerName,
      notice: `🦝 たぬきち「ようこそ、${playerName}さん。今日からNekoEcon村で暮らすニャ。まずは村を歩いて、きのこを3つ集めるニャ」`,
    },
  };
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
    next = {
      ...next,
      dayDone: true,
      notice: `🐱 ミケ「上手にきのこを集めたニャ！おれいに +${DAY1_REWARD}ニャル ニャ」`,
    };
  }

  return { ...state, player: { ...state.player, cash }, life: next };
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
  return {
    ...state,
    player: { ...state.player, cash: round2(state.player.cash + DAY4_REWARD) },
    life: fire(
      {
        ...life,
        hasLostItem: false,
        inventory,
        tamaIntimacy: life.tamaIntimacy + 2,
        dayDone: life.day === 4 ? true : life.dayDone,
        notice: `🐈 タマ「ありがとうニャ！珍しいお花と +${DAY4_REWARD}ニャル をあげるニャ🌸」（親密度+2）`,
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

/** Enter / leave the tent-interior screen. */
export function lifeEnterTent(state: GameState): GameState {
  return { ...state, life: { ...state.life, inside: true } };
}
export function lifeExitTent(state: GameState): GameState {
  return { ...state, life: { ...state.life, inside: false } };
}

/** Place an owned piece of furniture inside the tent (persists in `interior`). */
export function lifePlaceInterior(state: GameState, kind: FurnitureKind, x: number, y: number): GameState {
  const life = state.life;
  const idx = life.ownedFurniture.indexOf(kind);
  if (idx < 0) return state;
  const ownedFurniture = life.ownedFurniture.filter((_, i) => i !== idx);
  const piece = { id: `furn-${life.seq + 1}`, kind, x, y };
  return {
    ...state,
    life: {
      ...life,
      seq: life.seq + 1,
      ownedFurniture,
      interior: [...life.interior, piece],
      // DAY3 completes once something is placed inside (commit 5 moves this to 退室時).
      dayDone: life.day === 3 ? true : life.dayDone,
      notice:
        life.day === 3 && life.interior.length === 0
          ? '🛋️ おうちが少し楽しくなったニャ！\n\n集めて、売って、手に入れたニャルで家具を買えたニャ。お金は貯めるだけじゃなく、暮らしを良くするためにも使えるニャ。'
          : life.notice,
    },
  };
}

/** DAY4 「ヒントを見る」: reveal a temporary arrow over the lost item. */
export function lifeShowHint(state: GameState): GameState {
  return { ...state, life: { ...state.life, hintArrow: true } };
}

export function lifeBuildStall(state: GameState): GameState {
  const life = state.life;
  if (life.shopOpen) return state;
  if (life.inventory.wood < STALL_WOOD || state.player.cash < STALL_COST) return state;
  const inventory = { ...life.inventory, wood: life.inventory.wood - STALL_WOOD };
  const shop = { id: 'life-soup-shop', kind: 'soupFactory' as const, x: 38, y: 62 };
  return {
    ...state,
    player: { ...state.player, cash: round2(state.player.cash - STALL_COST) },
    facilities: { ...state.facilities, soupFactory: state.facilities.soupFactory + 1 },
    placements: [...state.placements, shop],
    life: fire(
      {
        ...life,
        inventory,
        shopOpen: true,
        dailyIncome: life.dailyIncome + STALL_INCOME,
        dayDone: life.day === 5 ? true : life.dayDone,
        notice: `🎉 ミケの屋台が完成！木材が積まれ、猫たちが拍手しているニャ（毎日+${STALL_INCOME}ニャル）`,
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
      notice: `🛤️ 道が開通！猫の足が速くなり、屋台の売上も増えたニャ（毎日+${ROAD_INCOME}ニャル）`,
    },
  };
}

export function lifeRepay(state: GameState): GameState {
  const life = state.life;
  if (state.player.cash < DAY7_REPAY) return state;
  const pay = Math.min(DAY7_REPAY, state.player.loan);
  const { cat: shiro, stock } = makeShiro();
  // 新区画の採集アイテムをまく
  let seq = life.seq;
  const newItems = (['fish', 'fish', 'flower', 'mushroom', 'wood'] as GatherKind[]).map((k) =>
    makeItem(seq++, k),
  );
  return {
    ...state,
    player: {
      ...state.player,
      cash: round2(state.player.cash - DAY7_REPAY),
      loan: round2(state.player.loan - pay),
    },
    cats: state.cats.some((c) => c.name === 'シロ') ? state.cats : [...state.cats, shiro],
    stocks: state.stocks['1'] ? state.stocks : { ...state.stocks, [shiro.id]: stock },
    life: fire(
      {
        ...life,
        seq,
        items: [...life.items, ...newItems],
        level: 2,
        loanUnlocked: true,
        dayDone: true,
        notice: '🎆 NekoEcon村 レベル2！花火が上がり、新住民シロが引っ越してきたニャ',
      },
      'fireworks',
      50,
      50,
    ),
  };
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
    // Dropped near the red-roof house (the hint タマ gives).
    const spot = { x: 18 + Math.random() * 8, y: 76 + Math.random() * 8 };
    items = [...items, { id: `item-${seq++}`, kind: 'bell', x: spot.x, y: spot.y }];
  } else if (day === 5) {
    const wood = [0, 1, 2].map(() => makeItem(seq++, 'wood'));
    items = [...items, ...wood];
  }
  return { ...life, seq, items, shopUnlocked, notice: DAY_INTRO[day] ?? life.notice };
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
  const cash = round2(state.player.cash + life.dailyIncome);

  // Wake タマ from any previous nap / chat so each day's event reads cleanly.
  let cats = state.cats.map((c) =>
    c.id === '3' ? { ...c, action: 'idle' as const, x: 60, y: 58 } : c,
  );

  let next: LifeState = {
    ...life,
    day,
    dayDone: false,
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
