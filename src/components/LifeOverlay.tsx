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
  const [day3Elapsed, setDay3Elapsed] = useState(0);
  const life = state.life;

  // DAY4: after ~25s of searching without finding the lost item, nudge harder.
  const searching = life.active && life.day === 4 && !life.hasLostItem;
  useEffect(() => {
    if (!searching) return;
    const start = Date.now();
    const id = setInterval(() => setDay4Elapsed(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [searching]);

  // DAY3: nudge the player toward たぬきち if they haven't gone over to him.
  // (たぬきち's life-mode map spot ≈ world (9.5, 0.5).)
  const goingToTanuki = life.active && life.day === 3 && !life.dayDone;
  const nearTanuki = Math.hypot(life.playerX - 74, life.playerY - 51) < 17;
  const needTanukiHint = goingToTanuki && !nearTanuki;
  useEffect(() => {
    if (!needTanukiHint) return;
    const start = Date.now();
    const id = setInterval(() => setDay3Elapsed(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [needTanukiHint]);

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
      {/* ---- Camera-control help (bottom-right) ---- */}
      <div className="absolute bottom-3 right-3 rounded-xl border-2 border-amber-200 bg-[#fffdf7]/85 px-2.5 py-1.5 text-[10px] font-bold leading-relaxed text-amber-700 shadow">
        🖱 ホイール: ズーム
        <br />
        Q / E ・ 右ドラッグ: 回転
        <br />
        C: 主人公中心にもどす
      </div>

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
      {!life.inside && (
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
          {searching && day4Elapsed > 15000 && (
            <div className="rounded-2xl border-4 border-rose-300 bg-white/95 px-4 py-2 text-sm font-black text-rose-700 shadow-lg">
              {day4Elapsed > 30000
                ? '🔦 光の柱が立っているところニャ！'
                : '🌲 赤い屋根の家のそば、木の近くでキラッと光ってるニャ！'}
            </div>
          )}
          {needTanukiHint && day3Elapsed > 10000 && (
            <div className="rounded-2xl border-4 border-amber-300 bg-white/95 px-4 py-2 text-sm font-black text-amber-800 shadow-lg">
              {day3Elapsed > 20000
                ? '🔴 赤い屋根のお店の前にいるニャ！'
                : '✨ 光っているたぬきちのところへ行こう'}
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

      {/* ---- Tent interior screen ---- */}
      {life.inside && <TentInterior life={life} dispatch={dispatch} />}

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
                        disabled={cash < price}
                        onClick={() => { dispatch({ type: 'LIFE_BUY_FURNITURE', kind: k }); close(); }}
                        className={`btn-press rounded-lg bg-amber-500 px-3 py-1 text-xs font-black text-white transition enabled:hover:bg-amber-600 disabled:opacity-40 ${
                          life.day === 3 && !life.dayDone ? 'tutorial-cta' : ''
                        }`}
                      >
                        {price}ニャル
                      </button>
                    </div>
                  );
                })}
              </div>
              {life.ownedFurniture.length > 0 && (
                <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-1.5 text-center text-xs font-black text-emerald-700">
                  🎒 持ち家具 {life.ownedFurniture.length}個 — テントに入って飾れるニャ
                </p>
              )}
            </>
          )}
        </Dialog>
      )}

      {/* ---- Big celebration / story notice (above the tent-interior screen) ---- */}
      {life.notice && (
        <div className="pointer-events-auto absolute inset-0 z-[66] flex items-center justify-center bg-black/45 p-4">
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

/** Simplified tent-interior screen: a room you decorate with owned furniture. */
function TentInterior({
  life,
  dispatch,
}: {
  life: GameState['life'];
  dispatch: (action: PolicyAction) => void;
}) {
  const [sel, setSel] = useState<FurnitureKind | null>(null);
  const counts = life.ownedFurniture.reduce<Partial<Record<FurnitureKind, number>>>((m, k) => {
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});
  const kinds = Object.keys(counts) as FurnitureKind[];

  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sel) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    dispatch({ type: 'LIFE_PLACE_INTERIOR', kind: sel, x, y });
    if ((counts[sel] ?? 0) <= 1) setSel(null);
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-[64] flex flex-col bg-[#2f2218] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-amber-100">🏠 {life.playerName}の部屋</h2>
        <button
          type="button"
          onClick={() => dispatch({ type: 'LIFE_EXIT_TENT' })}
          className="btn-press rounded-2xl border-2 border-amber-200 bg-amber-500 px-4 py-2 text-sm font-black text-white transition hover:bg-amber-600"
        >
          🚪 外に出る
        </button>
      </div>

      {/* Room floor (click to place the selected furniture) */}
      <div
        onClick={place}
        className="relative mt-3 flex-1 cursor-pointer overflow-hidden rounded-2xl border-[10px] border-[#6b4a2b] bg-[#cba87a]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-[#a9835a]" /> {/* back wall */}
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-8 w-24 -translate-x-1/2 rounded-t-lg bg-[#5b3f26] text-center text-[11px] font-black leading-8 text-amber-100">
          出入口
        </div>
        {life.interior.map((p) => (
          <span
            key={p.id}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-4xl drop-shadow"
          >
            {FURNITURE_META[p.kind].icon}
          </span>
        ))}
        {sel && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white">
            床をクリックして「{FURNITURE_META[sel].name}」を置くニャ
          </div>
        )}
      </div>

      {/* Owned-furniture tray */}
      <div className="mt-3 rounded-2xl bg-[#fffdf7]/95 p-3">
        <div className="text-xs font-black text-amber-700">🎒 持っている家具（選んで床をクリック）</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {kinds.length === 0 && (
            <span className="text-xs font-bold text-amber-500">
              家具がないニャ。たぬきち商店で買ってこよう
            </span>
          )}
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSel(k)}
              className={`btn-press rounded-xl border-2 px-3 py-1.5 text-sm font-black transition ${
                sel === k
                  ? 'border-amber-500 bg-amber-100 text-amber-900'
                  : 'border-amber-200 bg-white text-amber-700'
              }`}
            >
              {FURNITURE_META[k].icon} {FURNITURE_META[k].name} ×{counts[k]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
