import type { GameState } from '@/types/game';
import { round2 } from './math';

export const ROAD_COST = 10; // CC per road tile
export const ROAD_GDP_PER_TILE = 0.1; // CC per tile added to the village each tick

/** Stable key for a road grid cell. */
export function roadKey(gx: number, gz: number): string {
  return `${gx},${gz}`;
}

/** Lay one road tile (paid from cash). No-op if unaffordable or already paved. */
export function layRoad(state: GameState, gx: number, gz: number): GameState {
  if (state.player.cash < ROAD_COST) return state;
  const key = roadKey(gx, gz);
  if (state.roads.some((r) => roadKey(r.gx, r.gz) === key)) return state;
  return {
    ...state,
    player: { ...state.player, cash: round2(state.player.cash - ROAD_COST) },
    roads: [...state.roads, { gx, gz }],
  };
}

/**
 * Road network GDP: every tick the village's wealth grows by
 * roadCount * ROAD_GDP_PER_TILE, spread evenly across the cats (so it shows up
 * in totalMoney). Pure; runs before updateEconomy each tick.
 */
export function updateRoadEconomy(state: GameState): GameState {
  const n = state.roads.length;
  if (n === 0 || state.cats.length === 0) return state;
  const perCat = round2((n * ROAD_GDP_PER_TILE) / state.cats.length);
  if (perCat <= 0) return state;
  const cats = state.cats.map((c) => ({ ...c, money: round2(c.money + perCat) }));
  return { ...state, cats };
}
