'use client';

import type { PlayerPolicy, PolicyAction } from '@/types/game';

function Slider({
  icon,
  label,
  value,
  max,
  accent,
  onChange,
}: {
  icon: string;
  label: string;
  value: number;
  max: number;
  accent: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-2xl border-2 border-amber-100 bg-white/70 p-3">
      <div className="mb-1.5 flex items-center justify-between text-sm font-bold text-amber-900">
        <span className="flex items-center gap-1.5">
          <span className="text-lg">{icon}</span>
          {label}
        </span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 tabular-nums">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-2 w-full cursor-pointer appearance-none rounded-full bg-amber-100 ${accent}`}
      />
    </label>
  );
}

export default function ControlPanel({
  policy,
  dispatch,
}: {
  policy: PlayerPolicy;
  dispatch: (action: PolicyAction) => void;
}) {
  return (
    <div className="rounded-3xl border-4 border-amber-200 bg-[#fffdf7] p-4 shadow-md">
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-amber-900">
        <span className="text-xl">🏛️</span> 政策コントロール
      </h2>

      <button
        type="button"
        onClick={() => dispatch({ type: 'ISSUE_CURRENCY', amount: 100 })}
        className="btn-press btn-glow mb-4 w-full rounded-2xl bg-gradient-to-b from-orange-400 to-orange-500 px-4 py-3 text-lg font-extrabold text-white transition active:translate-y-1"
      >
        💴 +100CC 全員に配布！
      </button>

      <div className="flex flex-col gap-3">
        <Slider
          icon="🏦"
          label="金利"
          value={policy.interestRate}
          max={20}
          accent="accent-emerald-500"
          onChange={(v) => dispatch({ type: 'SET_INTEREST_RATE', value: v })}
        />
        <Slider
          icon="🧾"
          label="税率"
          value={policy.taxRate}
          max={50}
          accent="accent-rose-500"
          onChange={(v) => dispatch({ type: 'SET_TAX_RATE', value: v })}
        />
      </div>
    </div>
  );
}
