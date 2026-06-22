'use client';

import type { PlayerWallet, PolicyAction } from '@/types/game';
import { INITIAL_LOAN, tickInterest } from '@/lib/engine/loan';

/**
 * Loan repayment popup, opened by clicking the たぬきち banker NPC in the 3D
 * village. Controlled by `open` / `onClose`.
 */
export default function LoanModal({
  player,
  interestRate,
  dispatch,
  open,
  onClose,
}: {
  player: PlayerWallet;
  interestRate: number;
  dispatch: (action: PolicyAction) => void;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const paidOff = player.loan <= 0;
  const loan = Math.round(player.loan);
  const cash = Math.round(player.cash);
  const interest = tickInterest(player.loan, interestRate);
  const progress = Math.min(100, Math.max(0, (1 - player.loan / INITIAL_LOAN) * 100));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-3xl border-4 border-amber-300 bg-[#fffdf7] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-center text-lg font-extrabold text-amber-900">
          {paidOff ? '🏡 マイホーム' : '🦝 ネコ銀行 たぬきち'}
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
                <span className="font-bold tabular-nums text-red-600">{loan} ニャル</span>
              </div>
              <div className="flex justify-between">
                <span>あなたの所持金</span>
                <span className="font-bold tabular-nums">{cash} ニャル</span>
              </div>
              <div className="flex justify-between">
                <span>毎日の利息</span>
                <span className="font-bold tabular-nums text-orange-600">
                  −{interest} ニャル（金利 {interestRate}%）
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
                100 ニャル
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'REPAY_LOAN', amount: 1000 })}
                disabled={cash <= 0}
                className="btn-press rounded-2xl bg-amber-500 py-2 text-sm font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                1,000 ニャル
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
          onClick={onClose}
          className="btn-press mt-4 w-full rounded-2xl bg-amber-200 py-2 font-bold text-amber-900 transition hover:bg-amber-300"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
