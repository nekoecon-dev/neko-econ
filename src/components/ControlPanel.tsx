'use client';

import type { PlayerPolicy, PolicyAction } from '@/types/game';

export default function ControlPanel({
  policy,
  dispatch,
}: {
  policy: PlayerPolicy;
  dispatch: (action: PolicyAction) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
      <h2 className="mb-3 text-base font-bold">🏛️ 政策コントロール</h2>

      <button
        type="button"
        onClick={() => dispatch({ type: 'ISSUE_CURRENCY', amount: 100 })}
        className="mb-4 w-full rounded-lg bg-amber-500 px-3 py-2 font-semibold text-white transition hover:bg-amber-600 active:scale-[0.99]"
      >
        💴 +100CC 全員に配布
      </button>

      <label className="mb-3 block">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-gray-600">金利</span>
          <span className="font-semibold tabular-nums">{policy.interestRate}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={20}
          step={1}
          value={policy.interestRate}
          onChange={(e) =>
            dispatch({ type: 'SET_INTEREST_RATE', value: Number(e.target.value) })
          }
          className="w-full accent-amber-500"
        />
      </label>

      <label className="block">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-gray-600">税率</span>
          <span className="font-semibold tabular-nums">{policy.taxRate}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={policy.taxRate}
          onChange={(e) =>
            dispatch({ type: 'SET_TAX_RATE', value: Number(e.target.value) })
          }
          className="w-full accent-amber-500"
        />
      </label>
    </div>
  );
}
