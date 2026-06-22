'use client';

import { useEffect, useState } from 'react';
import type { FurnitureKind, GameState, GatherKind, PolicyAction } from '@/types/game';
import {
  DAY7_REPAY,
  FURNITURE_COST,
  FURNITURE_META,
  gatherIcon,
  gatherName,
  lifeObjective,
  SHOP_FURNITURE,
  SOUP_NEED,
  STALL_COST,
  STALL_WOOD,
} from '@/lib/engine/life';

const TIME_EMOJI = { morning: '🌅', day: '☀️', evening: '🌇' } as const;
const GATHER_ORDER: GatherKind[] = ['mushroom', 'fish', 'wood', 'flower'];

// Big "DAY N" splash subtitles shown at the start of each campaign day.
const DAY_SUBTITLE: Record<number, string> = {
  1: 'NekoEcon村へようこそ',
  2: 'はじめてのスープ',
  3: 'おうちを飾ろう',
  4: 'タマの落し物',
  5: 'ミケの屋台づくり',
  6: '道をつなげよう',
  7: 'はじめての返済',
};

/** Talking target, opened by clicking ミケ / タマ / たぬきち in the 3D scene. */
export type LifeTalking = 'mike' | 'tama' | 'tanuki' | null;

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
  const [nameInput, setNameInput] = useState('');
  const [day4Elapsed, setDay4Elapsed] = useState(0);
  const life = state.life;

  // DAY4: after ~25s of searching without finding the lost item, nudge harder.
  const searching = life.active && life.day === 4 && !life.hasLostItem;
  useEffect(() => {
    if (!searching) return;
    const start = Date.now();
    const id = setInterval(() => setDay4Elapsed(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [searching]);

  if (!life.active) return null;

  // ---- Opening name-entry screen ----
  if (life.playerName === '') {
    const confirm = () => dispatch({ type: 'LIFE_SET_NAME', name: nameInput });
    return (
      <div className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
        <div className="animate-pop w-full max-w-sm rounded-3xl border-4 border-amber-300 bg-[#fffdf7] p-7 text-center shadow-2xl">
          <div className="text-6xl">🐱</div>
          <h2 className="mt-3 text-2xl font-black text-amber-900">きみの名前を教えてニャ</h2>
          <input
            type="text"
            value={nameInput}
            maxLength={8}
            placeholder="ニャオ"
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm();
            }}
            className="mt-5 w-full rounded-2xl border-4 border-amber-300 bg-white px-4 py-3 text-center text-xl font-black text-amber-900 outline-none focus:border-amber-500"
          />
          <p className="mt-2 text-xs font-bold text-amber-600">未入力なら「ニャオ」になるニャ</p>
          <button
            type="button"
            onClick={confirm}
            className="btn-press mt-5 w-full rounded-2xl bg-amber-500 py-3 text-lg font-black text-white transition hover:bg-amber-600"
          >
            けってい
          </button>
        </div>
      </div>
    );
  }

  const cash = Math.round(state.player.cash);
  const close = () => setTalking(null);
  const furniturePrice = (k: FurnitureKind) => Math.round(FURNITURE_COST[k] * (life.sale ? 0.5 : 1));
  const shopItems: FurnitureKind[] =
    life.level >= 2 ? [...SHOP_FURNITURE, 'chair', 'rug', 'plant', 'statue'] : SHOP_FURNITURE;

  const campaign = life.day <= 7;
  const canAdvance = !campaign || life.dayDone;
  const advanceLabel = !campaign
    ? '🌙 1日進める'
    : life.dayDone
      ? '🌙 次の日へ'
      : '🎯 今日の目的をクリアしよう';

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] select-none">
      {/* ---- Big "DAY N" splash (fade-in + sparkle, CSS auto-dismiss). Keyed by
              the day so it replays once whenever the campaign day changes. ---- */}
      {life.day <= 7 && (
        <div
          key={life.day}
          className="pointer-events-none absolute inset-0 z-[63] flex items-center justify-center"
        >
          <div className="day-splash text-center">
            <div className="text-7xl font-black tracking-wider text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.65)]">
              ✨ DAY {life.day} ✨
            </div>
            <div className="mt-3 text-3xl font-black text-amber-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
              {DAY_SUBTITLE[life.day]}
            </div>
          </div>
        </div>
      )}

      {/* ---- Top-left HUD: cash / day / objective / inventory ---- */}
      <div className="pointer-events-auto absolute left-3 top-3 w-60 rounded-3xl border-4 border-amber-300 bg-[#fffdf7]/95 p-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-b from-yellow-100 to-amber-100 px-2.5 py-1">
            <span className="text-xl">👛</span>
            <span className="text-lg font-black tabular-nums text-amber-900">{cash.toLocaleString()} ニャル</span>
          </div>
          <div className="rounded-2xl bg-sky-100 px-2.5 py-1 text-sm font-black text-sky-800">
            {TIME_EMOJI[life.time]} {campaign ? `DAY${life.day}` : `${life.day}日目`}
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
          🎒 インベントリ{life.hasLostItem ? '（🔔落とし物）' : ''}
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

      {/* ---- Bottom-centre: event toast + day-6 road + advance button ---- */}
      {!life.placing && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-2">
          {life.event && (
            <div className="animate-pop rounded-2xl border-4 border-sky-300 bg-white/95 px-4 py-2 text-sm font-black text-sky-800 shadow-lg">
              {life.event}
            </div>
          )}
          {life.day === 1 && !life.hasMoved && (
            <div className="rounded-2xl border-4 border-emerald-300 bg-white/95 px-4 py-2 text-sm font-black text-emerald-800 shadow-lg">
              🖱️ 地面をクリックすると移動できるニャ
            </div>
          )}
          {searching && day4Elapsed > 25000 && (
            <div className="rounded-2xl border-4 border-rose-300 bg-white/95 px-4 py-2 text-sm font-black text-rose-700 shadow-lg">
              🌲 木のそばでキラッと光ってるニャ！
            </div>
          )}
          {searching && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'LIFE_SHOW_HINT' })}
              className="pointer-events-auto btn-press rounded-2xl border-2 border-amber-400 bg-white/95 px-5 py-1.5 text-sm font-black text-amber-700 shadow transition hover:bg-amber-50"
            >
              💡 ヒントを見る
            </button>
          )}
          {life.day === 6 && !life.roadDone && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'LIFE_CONNECT_ROAD' })}
              className="pointer-events-auto tutorial-cta btn-press rounded-2xl border-4 border-yellow-400 bg-gradient-to-b from-emerald-400 to-emerald-600 px-7 py-3 text-lg font-black text-white shadow-xl"
            >
              🛤️ 屋台とスープ鍋を道でつなぐ
            </button>
          )}
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => dispatch({ type: 'LIFE_ADVANCE_DAY' })}
            className="pointer-events-auto btn-press rounded-2xl border-4 border-yellow-400 bg-gradient-to-b from-amber-400 to-orange-500 px-8 py-3 text-lg font-black text-white shadow-xl transition enabled:hover:from-amber-300 enabled:hover:to-orange-400 disabled:opacity-50"
          >
            {advanceLabel}
          </button>
        </div>
      )}

      {/* ---- Placing furniture banner ---- */}
      {life.placing && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-6 flex flex-col items-center gap-2">
          <div className="rounded-2xl border-4 border-amber-400 bg-[#fffdf7]/95 px-4 py-2 text-sm font-black text-amber-800 shadow-lg">
            {FURNITURE_META[life.placing].icon} テントの近くに置く場所をクリックしてニャ
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

      {/* ---- ミケ ---- */}
      {talking === 'mike' && (
        <Dialog onClose={close} avatar="🐱" name="ミケ">
          {life.day === 1 ? (
            <p>まずはマップのきのこを3つ集めてくるニャ！</p>
          ) : life.day === 5 && !life.shopOpen ? (
            <>
              <p>スープ屋を開きたいニャ！木材{STALL_WOOD}個と{STALL_COST}ニャルで屋台を建てるニャ。</p>
              <p className="mt-1 text-sm text-amber-600">木材 {life.inventory.wood}/{STALL_WOOD} ・ 所持金 {cash}ニャル</p>
              <DialogButton
                disabled={life.inventory.wood < STALL_WOOD || cash < STALL_COST}
                onClick={() => { dispatch({ type: 'LIFE_BUILD_STALL' }); close(); }}
              >
                🔨 木材{STALL_WOOD}個と{STALL_COST}ニャルで屋台を建てる
              </DialogButton>
            </>
          ) : (
            <>
              <p>{life.shopOpen ? 'いらっしゃいニャ！屋台でスープを作るニャ？' : 'きのこ3つでスープを作るニャ！'}</p>
              <p className="mt-1 text-sm text-amber-600">きのこ {life.inventory.mushroom}/{SOUP_NEED}</p>
              <DialogButton
                disabled={life.inventory.mushroom < SOUP_NEED}
                onClick={() => { dispatch({ type: 'LIFE_GIVE_SOUP' }); close(); }}
              >
                🍲 きのこ{SOUP_NEED}個でスープを作る
              </DialogButton>
            </>
          )}
        </Dialog>
      )}

      {/* ---- タマ ---- */}
      {talking === 'tama' && (
        <Dialog onClose={close} avatar="🐈" name="タマ" tone="sky">
          {life.hasLostItem ? (
            <>
              <p>あっ、それ私の落とし物ニャ！見つけてくれてありがとうニャ！</p>
              <DialogButton onClick={() => { dispatch({ type: 'LIFE_GIVE_LOST' }); close(); }}>
                🔔 落とし物を渡す
              </DialogButton>
            </>
          ) : life.day === 4 ? (
            <p>赤い屋根のおうちの近くで落とし物（🔔）をした気がするニャ…探して拾ってきてほしいニャ。</p>
          ) : (
            <p>こんにちはニャ！（親密度 {life.tamaIntimacy}）</p>
          )}
        </Dialog>
      )}

      {/* ---- たぬきち ---- */}
      {talking === 'tanuki' && (
        <Dialog onClose={close} avatar="🦝" name="たぬきち" tone="sky">
          {!life.shopUnlocked ? (
            <p>家具店はDAY3で開くニャ。それまで待っててほしいニャ。</p>
          ) : life.day === 7 && !life.dayDone ? (
            <>
              <p>そろそろテント代を少し返してほしいニャ。{DAY7_REPAY}ニャルで大丈夫ニャ。</p>
              <DialogButton
                disabled={cash < DAY7_REPAY}
                onClick={() => { dispatch({ type: 'LIFE_REPAY' }); close(); }}
              >
                💰 {DAY7_REPAY}ニャル返済する
              </DialogButton>
            </>
          ) : (
            <>
              {life.sale && <p className="font-black text-rose-600">🏷️ 本日セール！全品はんがくニャ</p>}
              {life.loanUnlocked && (
                <p className="mb-1 text-sm font-bold text-amber-700">🏠 のこりテント代：{Math.round(state.player.loan)}ニャル</p>
              )}
              <div className="flex flex-col gap-1.5">
                {shopItems.map((k) => {
                  const price = furniturePrice(k);
                  return (
                    <div key={k} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-1.5">
                      <span className="text-sm font-black text-amber-900">
                        {FURNITURE_META[k].icon} {FURNITURE_META[k].name}
                      </span>
                      <button
                        type="button"
                        disabled={cash < price || life.placing !== null}
                        onClick={() => { dispatch({ type: 'LIFE_BUY_FURNITURE', kind: k }); close(); }}
                        className={`btn-press rounded-lg bg-amber-500 px-3 py-1 text-xs font-black text-white transition enabled:hover:bg-amber-600 disabled:opacity-40 ${
                          life.day === 3 && life.furniture.length === 0 ? 'tutorial-cta' : ''
                        }`}
                      >
                        {price}ニャル
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Dialog>
      )}

      {/* ---- Big celebration / story notice ---- */}
      {life.notice && (
        <div className="pointer-events-auto absolute inset-0 z-[62] flex items-center justify-center bg-black/45 p-4">
          <div className="animate-pop max-w-sm rounded-3xl border-4 border-amber-300 bg-[#fffdf7] p-7 text-center shadow-2xl">
            <div className="whitespace-pre-line text-lg font-black leading-relaxed text-amber-900">{life.notice}</div>
            <button
              type="button"
              onClick={() => dispatch({ type: 'LIFE_DISMISS_NOTICE' })}
              className="btn-press mt-5 w-full rounded-2xl bg-amber-500 py-2.5 text-base font-black text-white transition hover:bg-amber-600"
            >
              わかったニャ！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A centred dialog card with an emoji speaker. */
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
