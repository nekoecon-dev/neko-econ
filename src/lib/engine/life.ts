import type {
  FurnitureKind,
  GameState,
  GatherItem,
  GatherKind,
  LifeFx,
  LifeState,
  LifeTime,
} from '@/types/game';
import { round2 } from './math';

// --- Tuning -----------------------------------------------------------------
export const SOUP_NEED = 3; // mushrooms ミケ wants for a pot of soup
export const SOUP_REWARD = 100; // CC the player earns per soup
export const INVEST_COST = 100; // CC to build ミケのスープ屋

export const FURNITURE_COST: Record<FurnitureKind, number> = {
  chair: 60,
  lamp: 80,
  rug: 100,
  plant: 50,
  statue: 200,
};

export const FURNITURE_META: Record<FurnitureKind, { icon: string; name: string }> = {
  chair: { icon: '🪑', name: 'いす' },
  lamp: { icon: '💡', name: 'ランプ' },
  rug: { icon: '🟫', name: 'ラグ' },
  plant: { icon: '🪴', name: '観葉植物' },
  statue: { icon: '🗿', name: 'ねこ像' },
};

const GATHER_META: Record<GatherKind, { icon: string; name: string }> = {
  mushroom: { icon: '🍄', name: 'きのこ' },
  fish: { icon: '🐟', name: 'さかな' },
  wood: { icon: '🪵', name: '木材' },
  flower: { icon: '🌸', name: 'はな' },
};

export function gatherIcon(kind: GatherKind): string {
  return GATHER_META[kind].icon;
}
export function gatherName(kind: GatherKind): string {
  return GATHER_META[kind].name;
}

// A small clear box around the central plaza (map %) we keep items out of.
const PLAZA = { x0: 40, x1: 60, y0: 40, y1: 60 };

/** A random map spot out on the field but clear of the central plaza. */
function scatterSpot(): { x: number; y: number } {
  for (let tries = 0; tries < 12; tries++) {
    const x = 12 + Math.random() * 76;
    const y = 12 + Math.random() * 72;
    if (x > PLAZA.x0 && x < PLAZA.x1 && y > PLAZA.y0 && y < PLAZA.y1) continue;
    return { x, y };
  }
  return { x: 20, y: 20 };
}

/** Build one gatherable item near a sensible home (fish by the pond, etc.). */
function makeItem(seq: number, kind: GatherKind): GatherItem {
  let spot = scatterSpot();
  if (kind === 'fish') spot = { x: 24 + Math.random() * 6, y: 16 + Math.random() * 6 }; // by the pond
  if (kind === 'wood') spot = { x: 66 + Math.random() * 8, y: 26 + Math.random() * 8 }; // by the trees
  return { id: `item-${seq}`, kind, x: spot.x, y: spot.y };
}

/** The dormant life state carried by non-life GameStates. */
export function lifeInactive(): LifeState {
  return {
    active: false,
    day: 1,
    time: 'morning',
    weather: 'sunny',
    level: 1,
    sale: false,
    playerX: 50,
    playerY: 50,
    inventory: { mushroom: 0, fish: 0, wood: 0, flower: 0 },
    items: [],
    furniture: [],
    visitors: [],
    soupsMade: 0,
    shopOpen: false,
    placing: null,
    event: null,
    notice: null,
    fx: { id: 0, kind: null, x: 50, y: 50 },
    seq: 0,
  };
}

/** A fresh life game: a few mushrooms to find, plus a fish and some wood. */
export function lifeInitial(): LifeState {
  const base = lifeInactive();
  let seq = 0;
  const kinds: GatherKind[] = ['mushroom', 'mushroom', 'mushroom', 'mushroom', 'fish', 'wood'];
  const items = kinds.map((k) => makeItem(seq++, k));
  return { ...base, active: true, items, seq };
}

/** The 今日の目的 line, derived from progress (no extra state to keep in sync). */
export function lifeObjective(life: LifeState): string {
  if (life.soupsMade === 0 && life.inventory.mushroom < SOUP_NEED) {
    return '🍄 きのこを3つ集めよう（マップのきのこをクリック）';
  }
  if (life.soupsMade === 0) {
    return '🐱 ミケに話しかけてスープを作ってもらおう';
  }
  if (!life.shopOpen) {
    return '💰 ミケに投資して、スープ屋を建てよう';
  }
  if (life.furniture.length === 0) {
    return '🛋️ たぬきちの店で家具を買って、テントを飾ろう';
  }
  return '🌳 のんびり村で暮らそう（1日進めると何かが起きる）';
}

// --- helpers ----------------------------------------------------------------
function fire(life: LifeState, kind: LifeFx['kind'], x: number, y: number): LifeState {
  const seq = life.seq + 1;
  return { ...life, seq, fx: { id: seq, kind, x, y } };
}

// --- reducers (each takes & returns the whole GameState) ---------------------

export function lifeMove(state: GameState, x: number, y: number): GameState {
  return { ...state, life: { ...state.life, playerX: x, playerY: y } };
}

export function lifeGather(state: GameState, id: string): GameState {
  const item = state.life.items.find((i) => i.id === id);
  if (!item) return state;
  const inventory = { ...state.life.inventory, [item.kind]: state.life.inventory[item.kind] + 1 };
  return {
    ...state,
    life: {
      ...state.life,
      items: state.life.items.filter((i) => i.id !== id),
      inventory,
      // walk the avatar over to where the item was
      playerX: item.x,
      playerY: item.y,
    },
  };
}

export function lifeGiveSoup(state: GameState): GameState {
  const life = state.life;
  if (life.inventory.mushroom < SOUP_NEED) return state;
  const inventory = { ...life.inventory, mushroom: life.inventory.mushroom - SOUP_NEED };
  const soupsMade = life.soupsMade + 1;
  return {
    ...state,
    player: { ...state.player, cash: round2(state.player.cash + SOUP_REWARD) },
    life: fire(
      { ...life, inventory, soupsMade, notice: `🍲 スープ完成！ +${SOUP_REWARD}CC` },
      'soup',
      50,
      50,
    ),
  };
}

export function lifeInvest(state: GameState): GameState {
  const life = state.life;
  if (life.shopOpen || state.player.cash < INVEST_COST) return state;
  // The shop renders through the existing facility layer (a soupFactory).
  const shop = { id: 'life-soup-shop', kind: 'soupFactory' as const, x: 38, y: 62 };
  return {
    ...state,
    player: { ...state.player, cash: round2(state.player.cash - INVEST_COST) },
    facilities: { ...state.facilities, soupFactory: state.facilities.soupFactory + 1 },
    placements: [...state.placements, shop],
    life: fire(
      { ...life, shopOpen: true, notice: '🎉 ミケのスープ屋が開店した！' },
      'construct',
      shop.x,
      shop.y,
    ),
  };
}

export function lifeBuyFurniture(state: GameState, kind: FurnitureKind): GameState {
  const life = state.life;
  if (kind === 'statue' && life.level < 2) return state; // unlocked at the level-up
  const cost = Math.round(FURNITURE_COST[kind] * (life.sale ? 0.5 : 1));
  if (state.player.cash < cost || life.placing) return state;
  return {
    ...state,
    player: { ...state.player, cash: round2(state.player.cash - cost) },
    life: { ...life, placing: kind },
  };
}

export function lifePlaceFurniture(state: GameState, x: number, y: number): GameState {
  const life = state.life;
  if (!life.placing) return state;
  const piece = { id: `furn-${life.seq + 1}`, kind: life.placing, x, y };
  return {
    ...state,
    life: { ...life, seq: life.seq + 1, furniture: [...life.furniture, piece], placing: null },
  };
}

export function lifeCancelPlacing(state: GameState): GameState {
  return { ...state, life: { ...state.life, placing: null } };
}

export function lifeLevelUp(state: GameState): GameState {
  const life = state.life;
  return {
    ...state,
    life: fire(
      { ...life, level: life.level + 1, notice: `🎆 村レベル${life.level + 1}！新しい家具を解放したニャ` },
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

/**
 * Advance one day. Every press visibly changes the village: the clock rolls,
 * and one random event fires (new items, a visitor, a sale, blossoms, …).
 */
export function lifeAdvanceDay(state: GameState): GameState {
  const life = state.life;
  let next: LifeState = {
    ...life,
    day: life.day + 1,
    time: NEXT_TIME[life.time],
    sale: false,
  };
  let seq = next.seq;

  const roll = Math.floor(Math.random() * 8);
  switch (roll) {
    case 0: {
      next = { ...next, weather: life.weather === 'sunny' ? 'rainy' : 'sunny' };
      next.event = next.weather === 'rainy' ? '☔ 雨が降ってきたニャ' : '☀️ いい天気になったニャ';
      break;
    }
    case 1: {
      const kinds: GatherKind[] = ['mushroom', 'mushroom', 'fish', 'wood'];
      const added = [0, 1, 2].map(() => makeItem(seq++, kinds[Math.floor(Math.random() * kinds.length)]));
      next = { ...next, items: [...next.items, ...added] };
      next.event = '🍄 新しい採集アイテムが出現したニャ';
      break;
    }
    case 2:
      next.event = '💬 ミケとタマがおしゃべりしているニャ';
      break;
    case 3: {
      const v = { id: `vis-${seq++}`, name: 'たびねこ', x: 30 + Math.random() * 40, y: 30 + Math.random() * 40 };
      next = { ...next, visitors: [...next.visitors, v] };
      next.event = '🧳 来訪者ねこが村に来たニャ';
      break;
    }
    case 4:
      next.event = next.shopOpen
        ? '🍲 ミケのスープ屋に行列ができているニャ'
        : '🐱 ミケがスープ屋を開きたがっているニャ';
      break;
    case 5: {
      const drop = makeItem(seq++, 'wood');
      next = { ...next, items: [...next.items, { ...drop, x: 58, y: 60 }] };
      next.event = '🪵 タマが落とし物をしたニャ';
      break;
    }
    case 6: {
      const flower = makeItem(seq++, 'flower');
      next = { ...next, items: [...next.items, flower] };
      next.event = '🌸 小さな花が咲いたニャ';
      break;
    }
    default:
      next = { ...next, sale: true };
      next.event = '🏷️ たぬきちが家具セールを始めたニャ';
      break;
  }

  return { ...state, life: { ...next, seq } };
}
