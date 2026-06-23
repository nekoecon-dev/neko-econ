'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Cat, GameState, NewsItem, PolicyAction } from '@/types/game';
import { updateAllCats } from '@/lib/engine/cats';
import { updateCompanies } from '@/lib/engine/companies';
import { nextWeatherState, updateEconomy } from '@/lib/engine/economy';
import { detectEvent, resetEventCooldowns } from '@/lib/engine/events';
import { FACILITY_COST, FACILITY_NEWS } from '@/lib/engine/facilities';
import { applyLoanInterest, repayLoan } from '@/lib/engine/loan';
import { updateLoanDeadline } from '@/lib/engine/loanDeadline';
import { updateMissions } from '@/lib/engine/missions';
import { resolveBubbles, startBubble } from '@/lib/engine/bubble';
import { layRoad, updateRoadEconomy } from '@/lib/engine/roads';
import { updateStrike } from '@/lib/engine/strike';
import {
  applyDividend,
  tutorialAdvanceDay,
  tutorialFinish,
  tutorialInvest,
  tutorialLayRoads,
  tutorialRepay,
  tutorialStart,
  tutorialSkip,
} from '@/lib/engine/tutorial';
import {
  INITIAL_STATE,
  LIFE_INITIAL_STATE,
  TUTORIAL_INITIAL_STATE,
} from '@/lib/engine/initialState';
import {
  lifeAdvanceDay,
  lifeBuildStall,
  lifeBuyFurniture,
  lifeConnectRoad,
  lifeDismissNotice,
  lifeEnterTent,
  lifeExitTent,
  lifeGather,
  lifeGiveLost,
  lifeGiveSoup,
  lifeLayRoad,
  lifeMove,
  lifeMoveInterior,
  lifePlaceInterior,
  lifeRemoveInterior,
  lifeRemoveRoad,
  lifeRepay,
  lifeRotateInterior,
  lifeSetName,
  lifeShowHint,
} from '@/lib/engine/life';
import { clamp, round2 } from '@/lib/engine/math';
import {
  applyStockShock,
  executeBuy,
  executeSell,
  SHOCK_BANKRUPT,
  SHOCK_RICH,
  updateStocks,
} from '@/lib/engine/stocks';

const DEFAULT_TICK_MS = 1500;

type WindowWithNeko = Window & typeof globalThis & { __neko?: GameState };

/**
 * Tick interval in ms. A `?turbo=<ms>` query param speeds up the loop (clamped
 * to 1..1000) so automated stress tests can run thousands of ticks quickly.
 */
function resolveTickMs(): number {
  if (typeof window === 'undefined') return DEFAULT_TICK_MS;
  const turbo = new URLSearchParams(window.location.search).get('turbo');
  if (turbo === null) return DEFAULT_TICK_MS;
  const ms = Number(turbo);
  if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_TICK_MS;
  return clamp(ms, 1, 1000);
}

/**
 * Gentle random walk so the cats visibly wander around the map. `speed` scales
 * the step size — 3x during hyperinflation (frenzy), 0 freezes them (handled by
 * the caller skipping the call) during a depression.
 */
function wander(cat: Cat, speed: number): Cat {
  const dx = (Math.random() - 0.5) * 10 * speed;
  const dy = (Math.random() - 0.5) * 10 * speed;
  return {
    ...cat,
    x: clamp(cat.x + dx, 5, 90),
    y: clamp(cat.y + dy, 5, 85),
  };
}

function applyPolicy(state: GameState, action: PolicyAction): GameState {
  switch (action.type) {
    case 'ISSUE_CURRENCY': {
      const cats = state.cats.map((c) => ({
        ...c,
        money: round2(c.money + action.amount),
      }));
      // Relief payouts during a strike count toward ending it.
      const strike = state.strike.active
        ? { ...state.strike, reliefCount: state.strike.reliefCount + 1 }
        : state.strike;
      return { ...state, cats, strike };
    }
    case 'SET_INTEREST_RATE':
      return { ...state, policy: { ...state.policy, interestRate: action.value } };
    case 'SET_TAX_RATE':
      return { ...state, policy: { ...state.policy, taxRate: action.value } };
    case 'BUY_STOCK':
      return executeBuy(state, action.catId);
    case 'SELL_STOCK':
      return executeSell(state, action.catId);
    case 'REPAY_LOAN':
      return repayLoan(state, action.amount);
    case 'LAY_ROAD':
      return layRoad(state, action.gx, action.gz);
    case 'TUTORIAL_START':
      return tutorialStart(state);
    case 'TUTORIAL_INVEST':
      return tutorialInvest(state);
    case 'TUTORIAL_ADVANCE_DAY':
      return tutorialAdvanceDay(state);
    case 'TUTORIAL_LAY_ROADS':
      return tutorialLayRoads(state);
    case 'TUTORIAL_REPAY':
      return tutorialRepay(state);
    case 'TUTORIAL_FINISH':
      return tutorialFinish(state);
    case 'TUTORIAL_SKIP':
      return tutorialSkip(state);
    case 'LIFE_SET_NAME':
      return lifeSetName(state, action.name);
    case 'LIFE_MOVE':
      return lifeMove(state, action.x, action.y);
    case 'LIFE_GATHER':
      return lifeGather(state, action.id);
    case 'LIFE_GIVE_SOUP':
      return lifeGiveSoup(state);
    case 'LIFE_GIVE_LOST':
      return lifeGiveLost(state);
    case 'LIFE_SHOW_HINT':
      return lifeShowHint(state);
    case 'LIFE_BUILD_STALL':
      return lifeBuildStall(state, action.choice);
    case 'LIFE_CONNECT_ROAD':
      return lifeConnectRoad(state);
    case 'LIFE_LAY_ROAD':
      return lifeLayRoad(state, action.gx, action.gz);
    case 'LIFE_REMOVE_ROAD':
      return lifeRemoveRoad(state, action.gx, action.gz);
    case 'LIFE_REPAY':
      return lifeRepay(state);
    case 'LIFE_BUY_FURNITURE':
      return lifeBuyFurniture(state, action.kind);
    case 'LIFE_ENTER_TENT':
      return lifeEnterTent(state);
    case 'LIFE_EXIT_TENT':
      return lifeExitTent(state);
    case 'LIFE_PLACE_INTERIOR':
      return lifePlaceInterior(state, action.kind, action.gx, action.gy, action.rot);
    case 'LIFE_MOVE_INTERIOR':
      return lifeMoveInterior(state, action.id, action.gx, action.gy);
    case 'LIFE_ROTATE_INTERIOR':
      return lifeRotateInterior(state, action.id);
    case 'LIFE_REMOVE_INTERIOR':
      return lifeRemoveInterior(state, action.id);
    case 'LIFE_ADVANCE_DAY':
      return lifeAdvanceDay(state);
    case 'LIFE_DISMISS_NOTICE':
      return lifeDismissNotice(state);
    case 'PLACE_FACILITY': {
      const cost = FACILITY_COST[action.kind];
      if (state.player.cash < cost) return state; // can't afford
      const placement = {
        id: `${action.kind}-${state.tick}-${state.placements.length}`,
        kind: action.kind,
        x: clamp(action.x, 5, 90),
        y: clamp(action.y, 5, 85),
      };
      const news: NewsItem = {
        tick: state.tick,
        event: '公共事業',
        text: FACILITY_NEWS[action.kind],
      };
      return {
        ...state,
        player: { ...state.player, cash: round2(state.player.cash - cost) },
        facilities: { ...state.facilities, [action.kind]: state.facilities[action.kind] + 1 },
        placements: [...state.placements, placement],
        newsLog: [news, ...state.newsLog].slice(0, 50),
      };
    }
    default:
      return state;
  }
}

export function useGameLoop(): {
  state: GameState;
  dispatch: (action: PolicyAction) => void;
  reset: () => void;
} {
  // Boot into life mode by default (the cosy living-in-the-village prototype).
  // `?turbo=` -> economy free-play baseline (automated stress tests);
  // `?mode=tutorial` -> the guided economy tutorial.
  const [state, setState] = useState<GameState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('turbo')) return INITIAL_STATE;
      if (params.get('mode') === 'tutorial') return TUTORIAL_INITIAL_STATE;
    }
    return LIFE_INITIAL_STATE;
  });

  // Mirror of the latest state for the event-detection effect.
  const stateRef = useRef<GameState>(state);
  // Guard against overlapping news fetches.
  const fetchingRef = useRef(false);

  // Keep the mirror in sync after each render (never during render). Also
  // expose the live state on window for automated stress tests.
  useEffect(() => {
    stateRef.current = state;
    if (typeof window !== 'undefined') {
      (window as WindowWithNeko).__neko = state;
    }
  });

  // Main tick loop: pure state transition only (no side effects here).
  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        if (prev.gameOver) return prev; // sim is frozen under the game-over screen
        if (prev.tutorial.active) return prev; // sim is paused during the tutorial
        if (prev.life.active) return prev; // life mode advances only on 「1日進める」
        const tick = prev.tick + 1;
        // An active venture hires idle cats this tick (lowers unemployment).
        const hiring = prev.cats.some((c) => c.company !== null);
        const onStrike = prev.strike.active;
        let next = updateAllCats(prev, { hiring, onStrike });
        next = { ...next, tick };
        next = updateRoadEconomy(next); // road network adds GDP to the village
        next = updateCompanies(next); // found / fail ventures (uses next.tick)
        next = updateEconomy(next, { freezePrice: onStrike }); // strike freezes price
        // Strike bleeds stocks -1%/tick; bubbles inflate them (faster at low rates).
        next = updateStocks(next, { onStrike, interestRate: next.policy.interestRate });
        next = resolveBubbles(next); // burst / soft-land any expired bubble
        next = updateStrike(next); // start / resolve strike for next tick
        // Weather drives movement: 3x frenzy in hyperinflation, frozen in a
        // depression, normal otherwise. Dramatic weather holds for a minimum
        // duration (see nextWeatherState) so it doesn't flicker.
        const weather = nextWeatherState(next.economy, prev.weather);
        const speed =
          weather.current === 'hyperinflation' ? 3 : weather.current === 'depression' ? 0 : 1;
        const cats = speed === 0 ? next.cats : next.cats.map((c) => wander(c, speed));
        next = { ...next, tick, weather, cats };
        next = applyLoanInterest(next); // bank charges interest on the player loan
        next = applyDividend(next); // ミケのスープ屋 pays the player a dividend
        next = updateMissions(next); // grant rewards for completed missions
        next = updateLoanDeadline(next); // forced repayment deadline / foreclosure
        return next;
      });
    }, resolveTickMs());
    return () => clearInterval(id);
  }, []);

  // Event detection + AI news fetch, driven by tick changes.
  useEffect(() => {
    const current = stateRef.current;
    if (current.tick === 0 || fetchingRef.current) return;
    // The tutorial advances ticks manually but should stay quiet: no event
    // detection, news fetches or stock shocks until free play begins. Life mode
    // is likewise economy-silent.
    if (current.tutorial.active || current.life.active) return;

    const event = detectEvent(current);
    if (!event) return;

    // News-linked stock shock: a "大儲け" headline spikes that cat's stock,
    // a "破産" headline crashes it. Decays back over the following ticks.
    const shockCatId = event.catId;
    if (shockCatId) {
      if (event.name === '大儲け') {
        // 大儲け spikes the stock and puts it into a 15s speculative bubble.
        setState((s) => startBubble(applyStockShock(s, shockCatId, SHOCK_RICH), shockCatId));
      } else if (event.name === '破産') {
        setState((s) => applyStockShock(s, shockCatId, SHOCK_BANKRUPT));
      }
    }

    fetchingRef.current = true;
    const snapshot = current;
    void (async () => {
      try {
        const res = await fetch('/api/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventName: event.name,
            economy: snapshot.economy,
            cats: snapshot.cats,
            catName: event.catName,
          }),
        });
        const data: { news?: string } = await res.json();
        if (data.news) {
          const item: NewsItem = { tick: snapshot.tick, event: event.name, text: data.news };
          setState((s) => ({ ...s, newsLog: [item, ...s.newsLog].slice(0, 50) }));
        }
      } catch {
        // Network failure: silently skip this headline.
      } finally {
        fetchingRef.current = false;
      }
    })();
  }, [state.tick]);

  const dispatch = useCallback((action: PolicyAction) => {
    setState((prev) => applyPolicy(prev, action));
  }, []);

  // Restart the game from the initial state (used by the game-over retry button).
  const reset = useCallback(() => {
    resetEventCooldowns();
    fetchingRef.current = false;
    setState(INITIAL_STATE);
  }, []);

  return { state, dispatch, reset };
}
