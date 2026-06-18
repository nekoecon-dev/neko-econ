'use client';

import { useState } from 'react';
import type { Cat, PlayerWallet, PolicyAction, StockShare } from '@/types/game';

// Fur dot colours mirror the cats on the map (keyed by id).
const DOT: Record<string, string> = {
  '1': '#e2e8f0',
  '2': '#6b7280',
  '3': '#fb923c',
  '4': '#fcd34d',
  '5': '#f97316',
};

function ShockBadge({ shock }: { shock: number }) {
  if (shock > 1.05) {
    return <span className="rounded bg-red-100 px-1 text-[10px] font-bold text-red-600">🔺急騰</span>;
  }
  if (shock < 0.95) {
    return <span className="rounded bg-sky-100 px-1 text-[10px] font-bold text-sky-600">🔻暴落</span>;
  }
  return null;
}

function StockRow({
  cat,
  stock,
  shares,
  basis,
  canBuy,
  onBuy,
  onSell,
}: {
  cat: Cat;
  stock: StockShare;
  shares: number;
  basis: number;
  canBuy: boolean;
  onBuy: () => void;
  onSell: () => void;
}) {
  const price = Math.round(stock.price);
  const pnl = shares > 0 ? Math.round(shares * stock.price - basis) : 0;
  const pnlTone = pnl > 0 ? 'text-green-600' : pnl < 0 ? 'text-red-600' : 'text-amber-800/60';

  return (
    <div className="rounded-2xl border-2 border-amber-100 bg-white/70 p-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-bold text-amber-900">
          <span
            className="inline-block h-3 w-3 rounded-full ring-1 ring-amber-300"
            style={{ backgroundColor: DOT[cat.id] ?? '#fcd34d' }}
          />
          {cat.name}
          <ShockBadge shock={stock.shock} />
        </span>
        <span className="tabular-nums font-extrabold text-amber-900">{price} CC</span>
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-amber-800/80">
        <span>
          保有 <span className="font-bold tabular-nums">{shares}</span> 株
        </span>
        <span>
          含み損益{' '}
          <span className={`font-bold tabular-nums ${pnlTone}`}>
            {shares > 0 ? `${pnl >= 0 ? '+' : ''}${pnl} CC` : '—'}
          </span>
        </span>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onBuy}
          disabled={!canBuy}
          className="btn-press flex-1 rounded-xl bg-emerald-500 py-1.5 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
        >
          買う
        </button>
        <button
          type="button"
          onClick={onSell}
          disabled={shares <= 0}
          className="btn-press flex-1 rounded-xl bg-rose-500 py-1.5 text-sm font-bold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
        >
          売る
        </button>
      </div>
    </div>
  );
}

export default function StockMarket({
  cats,
  stocks,
  player,
  dispatch,
}: {
  cats: Cat[];
  stocks: Record<string, StockShare>;
  player: PlayerWallet;
  dispatch: (action: PolicyAction) => void;
}) {
  const [showEdu, setShowEdu] = useState(false);

  const handleBuy = (catId: string) => {
    // First-ever purchase triggers the one-time education popup. Buttons are
    // disabled when unaffordable, so a click here always results in a buy.
    if (!player.hasEverInvested) setShowEdu(true);
    dispatch({ type: 'BUY_STOCK', catId });
  };

  return (
    <div className="rounded-3xl border-4 border-amber-200 bg-[#fffdf7] p-4 shadow-md">
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-amber-900">
        <span className="text-xl">📈</span> 株式市場
      </h2>

      <div className="flex flex-col gap-2">
        {cats.map((cat) => {
          const stock = stocks[cat.id];
          if (!stock) return null;
          const shares = player.holdings[cat.id] ?? 0;
          const basis = player.costBasis[cat.id] ?? 0;
          // Buy is gated ONLY on affordability (cash >= price) — the 9999 CC
          // price cap never disables buying.
          const canBuy = player.cash >= stock.price;
          return (
            <StockRow
              key={cat.id}
              cat={cat}
              stock={stock}
              shares={shares}
              basis={basis}
              canBuy={canBuy}
              onBuy={() => handleBuy(cat.id)}
              onSell={() => dispatch({ type: 'SELL_STOCK', catId: cat.id })}
            />
          );
        })}
      </div>

      {showEdu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowEdu(false)}
          role="presentation"
        >
          <div
            className="max-w-sm rounded-3xl border-4 border-amber-300 bg-[#fffdf7] p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="text-5xl">🐱💡</div>
            <h3 className="mt-2 text-lg font-extrabold text-amber-900">はじめての投資ニャ！</h3>
            <p className="mt-2 text-sm leading-relaxed text-amber-800">
              投資とは、企業（猫）の成長にお金を預けることニャ。
              預けた猫が成長すれば株価が上がって利益になるけど、
              うまくいかないと損をすることもあるから気をつけてニャ！
            </p>
            <button
              type="button"
              onClick={() => setShowEdu(false)}
              className="btn-press mt-4 w-full rounded-2xl bg-amber-500 py-2 font-bold text-white transition hover:bg-amber-600"
            >
              わかったニャ！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
