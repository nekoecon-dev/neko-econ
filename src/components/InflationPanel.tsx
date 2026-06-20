'use client';

import dynamic from 'next/dynamic';
import type { Economy } from '@/types/game';

// Recharts' ResponsiveContainer can't measure during SSR, so load client-only.
const InflationChart = dynamic(() => import('./InflationChart'), { ssr: false });

/** A compact, overlay-only inflation graph (the rest of the dashboard now lives
 *  in the 3D world: signs, levers, and the thermometer gauges). */
export default function InflationPanel({ economy }: { economy: Economy }) {
  const data = economy.inflationHistory.map((rate, i) => ({ t: i + 1, inflation: rate }));

  return (
    <div className="w-48 rounded-2xl border-2 border-amber-200 bg-[#fffdf7]/90 p-2 shadow-md backdrop-blur">
      <p className="mb-1 text-[10px] font-bold text-amber-800/80">📈 インフレ率（直近20tick）</p>
      <div className="h-24">
        <InflationChart data={data} />
      </div>
    </div>
  );
}
