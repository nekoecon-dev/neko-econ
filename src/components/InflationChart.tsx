'use client';

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface InflationPoint {
  t: number;
  inflation: number;
}

export default function InflationChart({ data }: { data: InflationPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" width={32} />
        <Tooltip
          formatter={(value) => [`${value}%`, 'インフレ率']}
          labelFormatter={(label) => `tick ${label}`}
        />
        <Line
          type="monotone"
          dataKey="inflation"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
