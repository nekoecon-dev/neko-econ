'use client';

import { useEffect, useState } from 'react';
import type { PlayerWallet, PolicyAction } from '@/types/game';
import { INITIAL_LOAN, tickInterest } from '@/lib/engine/loan';

// The player's dwelling: a tent while in debt, a proper house once paid off.
function Tent() {
  return (
    <svg width={48} height={44} viewBox="0 0 48 44" className="drop-shadow">
      <path d="M24 6 L44 40 H4 Z" fill="#d97706" stroke="#92400e" strokeWidth={2} />
      <path d="M24 6 L24 40" stroke="#92400e" strokeWidth={2} />
      <path d="M24 18 L33 40 H15 Z" fill="#7c2d12" />
      <path d="M24 6 L24 1" stroke="#92400e" strokeWidth={2} strokeLinecap="round" />
      <circle cx={24} cy={1} r={2} fill="#ef4444" />
    </svg>
  );
}

function House() {
  return (
    <svg width={52} height={48} viewBox="0 0 52 48" className="drop-shadow">
      {/* roof */}
      <path d="M26 4 L48 22 H4 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth={2} />
      {/* walls */}
      <rect x={10} y={22} width={32} height={22} fill="#fcd34d" stroke="#92400e" strokeWidth={2} />
      {/* door */}
      <rect x={22} y={30} width={8} height={14} fill="#7c2d12" />
      {/* window */}
      <rect x={13} y={26} width={7} height={7} fill="#bae6fd" stroke="#0369a1" strokeWidth={1} />
      {/* chimney */}
      <rect x={36} y={8} width={5} height={9} fill="#7f1d1d" />
    </svg>
  );
}

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
  const [celebrate, setCelebrate] = useState(false);

  const paidOff = player.loan <= 0;
  const loan = Math.round(player.loan);
  const cash = Math.round(player.cash);
  const interest = tickInterest(player.loan, interestRate);
  const progress = Math.min(100, Math.max(0, (1 - player.loan / INITIAL_LOAN) * 100));

  // Fire a one-time celebration the moment the loan hits zero. The show/hide are
  // scheduled (not set synchronously) so the effect just drives the timers.
  useEffect(() => {
    if (!paidOff) return;
    const show = setTimeout(() => setCelebrate(true), 0);
    const hide = setTimeout(() => setCelebrate(false), 5000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [paidOff]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`absolute z-30 flex flex-col items-center ${className ?? ''}`}
        title="クリックでローン返済"
      >
        {paidOff ? <House /> : <Tent />}
        <span
          className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold shadow ${
            paidOff ? 'bg-emerald-600 text-white' : 'bg-red-700 text-white'
          }`}
        >
          {paidOff ? 'マイホーム🎉' : `借金 ${loan} CC`}
        </span>
      </button>

      {/* payoff celebration banner */}
      {celebrate && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 z-40 -translate-x-1/2 animate-pop rounded-2xl border-4 border-emerald-400 bg-white/95 px-5 py-3 text-center shadow-2xl">
          <div className="text-lg font-black text-emerald-700">🎉 ローン完済！</div>
          <div className="text-sm font-bold text-amber-800">テントが一軒家にアップグレード！</div>
        </div>
      )}

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

            {/* repayment progress bar */}
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px] font-bold text-amber-700/80">
                <span>返済の進捗</span>
                <span className="tabular-nums">{Math.round(progress)}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-amber-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {paidOff ? (
              <p className="mt-4 text-center text-sm text-amber-800">
                ローンは完済済みニャ！立派な一軒家になったニャ🎉
              </p>
            ) : (
              <>
                <div className="mt-4 space-y-1 text-sm text-amber-900">
                  <div className="flex justify-between">
                    <span>残りの借金</span>
                    <span className="font-bold tabular-nums text-red-600">{loan} CC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>あなたの所持金</span>
                    <span className="font-bold tabular-nums">{cash} CC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>毎tickの利息</span>
                    <span className="font-bold tabular-nums text-orange-600">
                      −{interest} CC（金利 {interestRate}%）
                    </span>
                  </div>
                </div>

                <p className="mt-3 rounded-xl bg-orange-100 px-2.5 py-1.5 text-center text-[11px] font-bold text-orange-700">
                  ⚠️ 金利を上げると利息が増えます
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'REPAY_LOAN', amount: 100 })}
                    disabled={cash <= 0}
                    className="btn-press rounded-2xl bg-amber-400 py-2 text-sm font-bold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    100 CC
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'REPAY_LOAN', amount: 1000 })}
                    disabled={cash <= 0}
                    className="btn-press rounded-2xl bg-amber-500 py-2 text-sm font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    1,000 CC
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'REPAY_LOAN', amount: player.cash })}
                    disabled={cash <= 0}
                    className="btn-press rounded-2xl bg-emerald-500 py-2 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    全額
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
