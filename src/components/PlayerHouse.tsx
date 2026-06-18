'use client';

import { useState } from 'react';
import type { PlayerWallet, PolicyAction } from '@/types/game';

export default function PlayerHouse({
  player,
  interestRate,
  dispatch,
  className,
}: {
  player: PlayerWallet;
  interestRate: number;
  dispatch: (action: PolicyAction) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const paidOff = player.loan <= 0;
  const loan = Math.round(player.loan);
  const cash = Math.round(player.cash);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`absolute z-30 flex flex-col items-center ${className ?? ''}`}
        title="クリックでローン返済"
      >
        <span className="text-4xl drop-shadow">{paidOff ? '🏡' : '⛺'}</span>
        <span
          className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold shadow ${
            paidOff ? 'bg-emerald-600 text-white' : 'bg-red-700 text-white'
          }`}
        >
          {paidOff ? 'マイホーム🎉' : `借金 ${loan} CC`}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-3xl border-4 border-amber-300 bg-[#fffdf7] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-center text-lg font-extrabold text-amber-900">
              {paidOff ? '🏡 マイホーム' : '🏦 シロ銀行 ローン返済'}
            </h3>

            {paidOff ? (
              <p className="mt-3 text-center text-sm text-amber-800">
                ローンは完済済みニャ！立派な一軒家になったニャ🎉
              </p>
            ) : (
              <>
                <div className="mt-3 space-y-1 text-sm text-amber-900">
                  <div className="flex justify-between">
                    <span>残りの借金</span>
                    <span className="font-bold tabular-nums text-red-600">{loan} CC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>あなたの所持金</span>
                    <span className="font-bold tabular-nums">{cash} CC</span>
                  </div>
                  <div className="flex justify-between text-xs text-amber-700/80">
                    <span>現在の金利</span>
                    <span className="tabular-nums">{interestRate}%（毎tick利息が引かれます）</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'REPAY_LOAN', amount: 1000 })}
                    disabled={cash <= 0}
                    className="btn-press flex-1 rounded-2xl bg-amber-500 py-2 font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    1,000 CC 返済
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'REPAY_LOAN', amount: player.cash })}
                    disabled={cash <= 0}
                    className="btn-press flex-1 rounded-2xl bg-emerald-500 py-2 font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    全額返済
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-amber-700/70">
                  ※ 金利を下げると利息の負担も軽くなるニャ
                </p>
              </>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-press mt-4 w-full rounded-2xl bg-amber-200 py-2 font-bold text-amber-900 transition hover:bg-amber-300"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
