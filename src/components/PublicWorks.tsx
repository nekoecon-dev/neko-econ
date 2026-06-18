'use client';

import type { FacilityKind, FacilityState, PolicyAction } from '@/types/game';
import { FACILITY_COST, FACILITY_META } from '@/lib/engine/facilities';

const KINDS: FacilityKind[] = ['soupFactory', 'matatabiPark', 'fishingPond'];

export default function PublicWorks({
  facilities,
  cash,
  dispatch,
}: {
  facilities: FacilityState;
  cash: number;
  dispatch: (action: PolicyAction) => void;
}) {
  return (
    <div className="rounded-3xl border-4 border-amber-200 bg-[#fffdf7] p-4 shadow-md">
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-amber-900">
        <span className="text-xl">🏗️</span> 公共事業
      </h2>

      <div className="flex flex-col gap-2">
        {KINDS.map((kind) => {
          const cost = FACILITY_COST[kind];
          const meta = FACILITY_META[kind];
          const count = facilities[kind];
          const afford = cash >= cost;
          return (
            <div key={kind} className="rounded-2xl border-2 border-amber-100 bg-white/70 p-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-amber-900">
                  <span className="text-lg">{meta.icon}</span>
                  {meta.name}
                  {count > 0 && (
                    <span className="rounded-full bg-amber-200 px-1.5 text-[10px] font-bold text-amber-800">
                      ×{count}
                    </span>
                  )}
                </span>
                <span className="text-xs font-bold tabular-nums text-amber-700">{cost} CC</span>
              </div>
              <div className="mt-0.5 text-[11px] text-amber-700/80">{meta.effect}</div>
              <button
                type="button"
                onClick={() => dispatch({ type: 'BUY_FACILITY', kind })}
                disabled={!afford}
                className="btn-press mt-2 w-full rounded-xl bg-sky-500 py-1.5 text-sm font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                建設する
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
