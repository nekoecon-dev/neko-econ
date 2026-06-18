'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Cat, GameState, NewsItem, PolicyAction } from '@/types/game';
import { updateAllCats } from '@/lib/engine/cats';
import { updateEconomy } from '@/lib/engine/economy';
import { detectEvent } from '@/lib/engine/events';
import { INITIAL_STATE } from '@/lib/engine/initialState';
import { clamp, round2 } from '@/lib/engine/math';

const DEFAULT_TICK_MS = 500;

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

/** Gentle random walk so the cats visibly wander around the map. */
function wander(cat: Cat): Cat {
  const dx = (Math.random() - 0.5) * 10;
  const dy = (Math.random() - 0.5) * 10;
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
      return { ...state, cats };
    }
    case 'SET_INTEREST_RATE':
      return { ...state, policy: { ...state.policy, interestRate: action.value } };
    case 'SET_TAX_RATE':
      return { ...state, policy: { ...state.policy, taxRate: action.value } };
    default:
      return state;
  }
}

export function useGameLoop(): {
  state: GameState;
  dispatch: (action: PolicyAction) => void;
} {
  const [state, setState] = useState<GameState>(INITIAL_STATE);

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
        let next = updateAllCats(prev);
        next = updateEconomy(next);
        next = { ...next, tick: prev.tick + 1, cats: next.cats.map(wander) };
        return next;
      });
    }, resolveTickMs());
    return () => clearInterval(id);
  }, []);

  // Event detection + AI news fetch, driven by tick changes.
  useEffect(() => {
    const current = stateRef.current;
    if (current.tick === 0 || fetchingRef.current) return;

    const event = detectEvent(current);
    if (!event) return;

    fetchingRef.current = true;
    const snapshot = current;
    void (async () => {
      try {
        const res = await fetch('/api/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventName: event,
            economy: snapshot.economy,
            cats: snapshot.cats,
          }),
        });
        const data: { news?: string } = await res.json();
        if (data.news) {
          const item: NewsItem = { tick: snapshot.tick, event, text: data.news };
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

  return { state, dispatch };
}
