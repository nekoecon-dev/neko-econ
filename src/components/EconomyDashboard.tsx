'use client';

import dynamic from 'next/dynamic';
import type { Economy } from '@/types/game';

// Recharts' ResponsiveContainer can't measure during SSR, so load client-only.
const InflationChart = dynamic(() => import('./InflationChart'), { ssr: false });

/** Re-plays a subtle pop animation whenever the value changes (key remount). */
function AnimatedValue({ value, className }: { value: string; className?: string }) {
  return (
    <span key={value} className={`inline-block animate-pop tabular-nums ${className ?? ''}`}>
      {value}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  tone: string;
  accent: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-2xl border-2 p-2.5 ${accent}`}>
      <span className="text-2xl leading-none">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-amber-800/70">{label}</div>
        <div className={`text-lg font-extrabold ${tone}`}>
          <AnimatedValue value={value} />
        </div>
      </div>
    </div>
  );
}

export default function EconomyDashboard({ economy }: { economy: Economy }) {
  const inflationTone =
    economy.inflationRate > 10
      ? 'text-red-600'
      : economy.inflationRate < 0
        ? 'text-sky-600'
        : 'text-green-600';
  const unemploymentTone = economy.unemploymentRate > 30 ? 'text-red-600' : 'text-amber-900';
  const giniTone = economy.gini > 0.6 ? 'text-red-600' : 'text-amber-900';

  const chartData = economy.inflationHistory.map((rate, i) => ({
    t: i + 1,
    inflation: rate,
  }));

  const inflationLabel = `${economy.inflationRate >= 0 ? '+' : ''}${economy.inflationRate}%`;

  return (
    <div className="rounded-3xl border-4 border-amber-200 bg-[#fffdf7] p-4 shadow-md">
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-amber-900">
        <span className="text-xl">📊</span> 経済ダッシュボード
      </h2>

      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon="🍲"
          label="スープ価格"
          value={`${economy.soupPrice} CC`}
          tone="text-amber-900"
          accent="border-orange-200 bg-orange-50"
        />
        <StatCard
          icon="📈"
          label="インフレ率"
          value={inflationLabel}
          tone={inflationTone}
          accent="border-rose-200 bg-rose-50"
        />
        <StatCard
          icon="😿"
          label="失業率"
          value={`${economy.unemploymentRate}%`}
          tone={unemploymentTone}
          accent="border-amber-200 bg-amber-50"
        />
        <StatCard
          icon="⚖️"
          label="格差指数"
          value={economy.gini.toFixed(2)}
          tone={giniTone}
          accent="border-lime-200 bg-lime-50"
        />
        <div className="col-span-2">
          <StatCard
            icon="💰"
            label="村の総通貨量"
            value={`${economy.totalMoney} CC`}
            tone="text-amber-900"
            accent="border-yellow-200 bg-yellow-50"
          />
        </div>
      </div>

      <div className="mt-3 flex h-36 w-full flex-col rounded-2xl border-2 border-amber-100 bg-white/70 p-2">
        <p className="mb-1 text-xs font-semibold text-amber-800/70">
          インフレ率の推移（直近20tick）
        </p>
        <div className="min-h-0 flex-1">
          <InflationChart data={chartData} />
        </div>
      </div>
    </div>
  );
}
