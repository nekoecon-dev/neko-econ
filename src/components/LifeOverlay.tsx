'use client';

import { useState } from 'react';
import type { FurnitureKind, GameState, GatherKind, PolicyAction } from '@/types/game';
import {
  FURNITURE_COST,
  FURNITURE_META,
  gatherIcon,
  gatherName,
  INVEST_COST,
  lifeObjective,
  SOUP_NEED,
} from '@/lib/engine/life';

const TIME_EMOJI = { morning: '🌅', day: '☀️', evening: '🌇' } as const;
const GATHER_ORDER: GatherKind[] = ['mushroom', 'fish', 'wood', 'flower'];
const SHOP_ITEMS: FurnitureKind[] = ['plant', 'chair', 'lamp', 'rug', 'statue'];

/** Talking target, opened by clicking ミケ / たぬきち in the 3D scene. */
export type LifeTalking = 'mike' | 'tanuki' | null;

export default function LifeOverlay({
  state,
  dispatch,
  talking,
  setTalking,
}: {
  state: GameState;
  dispatch: (action: PolicyAction) => void;
  talking: LifeTalking;
  setTalking: (t: LifeTalking) => void;
}) {
  const [invOpen, setInvOpen] = useState(false);
  const life = state.life;
  if (!life.active) return null;

  const cash = Math.round(state.player.cash);
  const close = () => setTalking(null);
  const furniturePrice = (k: FurnitureKind) => Math.round(FURNITURE_COST[k] * (life.sale ? 0.5 : 1));

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] select-none">
      {/* ---- Top-left HUD: only the four things a new player needs ---- */}
      <div className="pointer-events-auto absolute left-3 top-3 w-60 rounded-3xl border-4 border-amber-300 bg-[#fffdf7]/95 p-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-b from-yellow-100 to-amber-100 px-2.5 py-1">
            <span className="text-xl">👛</span>
            <span className="text-lg font-black tabular-nums text-amber-900">{cash.toLocaleString()} CC</span>
          </div>
          <div className="rounded-2xl bg-sky-100 px-2.5 py-1 text-sm font-black text-sky-800">
            {TIME_EMOJI[life.time]} {life.day}日目
          </div>
        </div>
        <div className="mt-2 rounded-xl bg-amber-100 px-2.5 py-1.5 text-xs font-black leading-snug text-amber-800">
          🎯 今日の目的<br />
          {lifeObjective(life)}
        </div>
        <button
          type="button"
          onClick={() => setInvOpen((v) => !v)}
          className="btn-press mt-2 w-full rounded-2xl border-2 border-amber-300 bg-white/90 py-1.5 text-sm font-black text-amber-800 transition hover:bg-amber-50"
        >
          🎒 インベントリ
        </button>
        {invOpen && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {GATHER_ORDER.map((k) => (
              <div key={k} className="rounded-xl bg-emerald-50 px-2 py-1 text-center text-xs font-black text-emerald-800">
                {gatherIcon(k)} {gatherName(k)} ×{life.inventory[k]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Bottom-centre: 1日進める + the latest event toast ---- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-2">
        {life.event && (
          <div className="animate-pop rounded-2xl border-4 border-sky-300 bg-white/95 px-4 py-2 text-sm font-black text-sky-800 shadow-lg">
            {life.event}
          </div>
        )}
        {!life.placing && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'LIFE_ADVANCE_DAY' })}
            className="pointer-events-auto btn-press rounded-2xl border-4 border-yellow-400 bg-gradient-to-b from-amber-400 to-orange-500 px-8 py-3 text-lg font-black text-white shadow-xl transition hover:from-amber-300 hover:to-orange-400"
          >
            🌙 1日進める
          </button>
        )}
      </div>

      {/* ---- Placing furniture banner ---- */}
      {life.placing && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-6 flex flex-col items-center gap-2">
          <div className="rounded-2xl border-4 border-amber-400 bg-[#fffdf7]/95 px-4 py-2 text-sm font-black text-amber-800 shadow-lg">
            {FURNITURE_META[life.placing].icon} 置く場所をクリックしてニャ
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'LIFE_CANCEL_PLACING' })}
            className="btn-press rounded-2xl border-2 border-rose-300 bg-white/90 px-5 py-1.5 text-sm font-bold text-rose-600"
          >
            キャンセル
          </button>
        </div>
      )}

      {/* ---- ミケ conversation ---- */}
      {talking === 'mike' && (
        <Dialog onClose={close} avatar="🐱" name="ミケ">
          {life.soupsMade === 0 ? (
            <>
              <p>きのこを3つ持ってきてくれたら、スープを作るニャ！</p>
              <p className="mt-1 text-sm text-amber-600">きのこ {life.inventory.mushroom}/{SOUP_NEED}</p>
              <DialogButton
                disabled={life.inventory.mushroom < SOUP_NEED}
                onClick={() => { dispatch({ type: 'LIFE_GIVE_SOUP' }); close(); }}
              >
                🍲 きのこ3個でスープを作ってもらう
              </DialogButton>
            </>
          ) : !life.shopOpen ? (
            <>
              <p>スープが評判ニャ！{INVEST_COST}CC投資してくれたら、スープ屋を建てるニャ！</p>
              <DialogButton
                disabled={cash < INVEST_COST}
                onClick={() => { dispatch({ type: 'LIFE_INVEST' }); close(); }}
              >
                💰 {INVEST_COST}CC投資してスープ屋を建てる
              </DialogButton>
            </>
          ) : (
            <>
              <p>いらっしゃいニャ！またスープを作るニャ？</p>
              <p className="mt-1 text-sm text-amber-600">きのこ {life.inventory.mushroom}/{SOUP_NEED}</p>
              <DialogButton
                disabled={life.inventory.mushroom < SOUP_NEED}
                onClick={() => { dispatch({ type: 'LIFE_GIVE_SOUP' }); close(); }}
              >
                🍲 スープを作ってもらう
              </DialogButton>
            </>
          )}
        </Dialog>
      )}

      {/* ---- たぬきち's furniture shop ---- */}
      {talking === 'tanuki' && (
        <Dialog onClose={close} avatar="🦝" name="たぬきちの家具店" tone="sky">
          {life.sale && <p className="font-black text-rose-600">🏷️ 本日セール！全品はんがくニャ</p>}
          <div className="mt-2 flex flex-col gap-1.5">
            {SHOP_ITEMS.map((k) => {
              const locked = k === 'statue' && life.level < 2;
              const price = furniturePrice(k);
              return (
                <div key={k} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-1.5">
                  <span className="text-sm font-black text-amber-900">
                    {FURNITURE_META[k].icon} {FURNITURE_META[k].name}
                  </span>
                  <button
                    type="button"
                    disabled={locked || cash < price || life.placing !== null}
                    onClick={() => { dispatch({ type: 'LIFE_BUY_FURNITURE', kind: k }); close(); }}
                    className="btn-press rounded-lg bg-amber-500 px-3 py-1 text-xs font-black text-white transition enabled:hover:bg-amber-600 disabled:opacity-40"
                  >
                    {locked ? '🔒 レベル2' : `${price}CC`}
                  </button>
                </div>
              );
            })}
          </div>
          {life.shopOpen && life.furniture.length > 0 && (
            <DialogButton onClick={() => { dispatch({ type: 'LIFE_LEVEL_UP' }); close(); }}>
              🎆 村を発展させる（レベルアップ）
            </DialogButton>
          )}
        </Dialog>
      )}

      {/* ---- Big celebration notice ---- */}
      {life.notice && (
        <div className="pointer-events-auto absolute inset-0 z-[62] flex items-center justify-center bg-black/45 p-4">
          <div className="animate-pop max-w-sm rounded-3xl border-4 border-amber-300 bg-[#fffdf7] p-7 text-center shadow-2xl">
            <div className="text-2xl font-black leading-relaxed text-amber-900">{life.notice}</div>
            <button
              type="button"
              onClick={() => dispatch({ type: 'LIFE_DISMISS_NOTICE' })}
              className="btn-press mt-5 w-full rounded-2xl bg-amber-500 py-2.5 text-base font-black text-white transition hover:bg-amber-600"
            >
              やったー！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A centred dialog card with an emoji speaker (used by ミケ / たぬきち). */
function Dialog({
  avatar,
  name,
  tone = 'amber',
  onClose,
  children,
}: {
  avatar: string;
  name: string;
  tone?: 'amber' | 'sky';
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ring = tone === 'sky' ? 'border-sky-300' : 'border-amber-300';
  return (
    <div className="pointer-events-auto absolute inset-0 z-[61] flex items-end justify-center bg-black/30 p-4 pb-28">
      <div className={`animate-pop w-full max-w-md rounded-3xl border-4 ${ring} bg-white/97 p-5 shadow-2xl`}>
        <div className="flex items-center gap-3">
          <span className="text-5xl drop-shadow">{avatar}</span>
          <span className="text-sm font-black text-amber-600">{name}</span>
          <button
            type="button"
            onClick={onClose}
            className="btn-press ml-auto rounded-full border-2 border-amber-200 bg-white px-2.5 py-0.5 text-xs font-bold text-amber-700"
          >
            ✕
          </button>
        </div>
        <div className="mt-2 text-lg font-black leading-relaxed text-amber-900">{children}</div>
      </div>
    </div>
  );
}

function DialogButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="btn-press mt-3 w-full rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 py-2.5 text-base font-black text-white shadow-lg transition enabled:hover:from-amber-300 enabled:hover:to-orange-400 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
