'use client';

import { useState } from 'react';
import type { FacilityKind, FacilityState } from '@/types/game';
import { FACILITY_COST, FACILITY_KINDS, FACILITY_META } from '@/lib/engine/facilities';

export default function PublicWorks({
  facilities,
  cash,
  pending,
  onPick,
}: {
  facilities: FacilityState;
  cash: number;
  pending: FacilityKind | null;
  onPick: (kind: FacilityKind) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-3xl border-4 border-amber-200 bg-[#fffdf7] p-4 shadow-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-press flex w-full items-center justify-between text-base font-extrabold text-amber-900"
      >
        <span className="flex items-center gap-2">
          <span className="text-xl">🏗️</span> 公共事業
        </span>
        <span className="text-sm text-amber-600">{open ? '▲ 閉じる' : '▼ 建物を選ぶ'}</span>
      </button>

      {open && (
        <div className="mt-3">
          <p className="mb-2 rounded-xl bg-amber-100/70 px-2.5 py-1.5 text-[11px] font-bold text-amber-800">
            🔨「設置」を押すと建物がカーソルに付くニャ。マップをクリックして置くニャ！
          </p>
          <div className="flex flex-col gap-2">
            {FACILITY_KINDS.map((kind: FacilityKind) => {
              const cost = FACILITY_COST[kind];
              const meta = FACILITY_META[kind];
              const count = facilities[kind];
              const afford = cash >= cost;
              return (
                <div
                  key={kind}
                  draggable={afford}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', kind);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className={`rounded-2xl border-2 p-2.5 transition ${
                    afford
                      ? 'cursor-grab border-amber-200 bg-white/80 hover:border-sky-400 hover:bg-sky-50 active:cursor-grabbing'
                      : 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-60'
                  }`}
                  title={afford ? 'マップへドラッグして配置' : '所持金が足りないニャ'}
                >
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
                    <span className="text-xs font-bold tabular-nums text-amber-700">{cost} ニャル</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-amber-700/80">{meta.effect}</div>
                  <button
                    type="button"
                    disabled={!afford}
                    onClick={() => onPick(kind)}
                    className={`btn-press mt-1.5 w-full rounded-xl py-1 text-[11px] font-bold transition ${
                      pending === kind
                        ? 'bg-emerald-500 text-white'
                        : afford
                          ? 'bg-sky-500 text-white hover:bg-sky-600'
                          : 'cursor-not-allowed bg-gray-300 text-gray-500'
                    }`}
                  >
                    {pending === kind ? '🖱️ クリックで設置…' : afford ? '🔨 設置する' : '🚫 資金不足'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
