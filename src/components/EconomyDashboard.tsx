'use client';

import dynamic from 'next/dynamic';
import type { Economy } from '@/types/game';

// Recharts' ResponsiveContainer can't measure during SSR, so load client-only.
const InflationChart = dynamic(() => import('./InflationChart'), { ssr: false });

function Indicator({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-gray-100 py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export default function EconomyDashboard({ economy }: { economy: Economy }) {
  const inflationColor = economy.inflationRate > 10 ? 'text-red-600' : 'text-green-600';
  const unemploymentColor =
    economy.unemploymentRate > 30 ? 'text-red-600' : 'text-gray-900';
  const giniColor = economy.gini > 0.6 ? 'text-red-600' : 'text-gray-900';

  const chartData = economy.inflationHistory.map((rate, i) => ({
    t: i + 1,
    inflation: rate,
  }));

  const inflationLabel = `${economy.inflationRate >= 0 ? '+' : ''}${economy.inflationRate}%`;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
      <h2 className="mb-2 text-base font-bold">📊 経済ダッシュボード</h2>

      <Indicator label="スープ価格" value={`${economy.soupPrice} CC`} color="text-gray-900" />
      <Indicator label="インフレ率" value={inflationLabel} color={inflationColor} />
      <Indicator
        label="失業率"
        value={`${economy.unemploymentRate}%`}
        color={unemploymentColor}
      />
      <Indicator label="格差指数" value={economy.gini.toFixed(2)} color={giniColor} />
      <Indicator
        label="村の総通貨量"
        value={`${economy.totalMoney} CC`}
        color="text-gray-900"
      />

      <div className="mt-3 h-32 w-full">
        <p className="mb-1 text-xs text-gray-500">インフレ率の推移（直近20tick）</p>
        <InflationChart data={chartData} />
      </div>
    </div>
  );
}
