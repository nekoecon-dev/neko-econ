'use client';

import { useEffect, useState } from 'react';
import type { FurnitureKind, GameState, GatherKind, PolicyAction } from '@/types/game';
import {
  DAY7_REPAY,
  FURNITURE_COST,
  FURNITURE_META,
  gatherIcon,
  gatherName,
  LIFE_ROAD_COST,
  lifeObjective,
  lifeRoadConnected,
  MIN_ROAD_TILES,
  SHOP_FURNITURE,
  SOUP_NEED,
  STALL_COST,
  STALL_WOOD,
} from '@/lib/engine/life';

const TIME_EMOJI = { morning: '🌅', day: '☀️', evening: '🌇' } as const;
const GATHER_ORDER: GatherKind[] = ['mushroom', 'fish', 'wood', 'flower'];

// Big "DAY N" splash subtitles shown at the start of each campaign day.
// DAY1 opening conversation (たぬきち導入). `{name}` is replaced with the hero.
const DAY1_INTRO_LINES = [
  'ようこそ、{name}さん',
  '今日からここが、きみの暮らすNekoEcon村ニャ',
  'この村では、集めて、作って、売って、少しずつ暮らしをよくしていくニャ',
  'まずは村を歩いて、きのこを3つ集めてみるニャ',
];

const DAY_SUBTITLE: Record<number, string> = {
  1: 'NekoEcon村へようこそ',
  2: 'はじめてのスープ作り',
  3: 'おうちを飾ろう',
  4: 'タマの落し物',
  5: 'ミケの屋台づくり',
  6: '道をつなげよう',
  7: 'はじめての返済',
};

// Falling confetti/stars for the 目的達成 celebration.
const CELEBRATE_BITS = ['🎉', '⭐', '✨', '🎊', '💛', '⭐', '🎉', '✨', '🎊', '💫', '⭐', '✨'].map(
  (e, i) => ({ e, x: (i * 8.3 + 4) % 100, d: (i % 6) * 0.22 }),
);

// Sparkle positions (%), scattered around the DAY splash text.
const SPLASH_SPARKLES = [
  { x: 14, y: 26, d: 0 },
  { x: 84, y: 22, d: 0.3 },
  { x: 24, y: 70, d: 0.6 },
  { x: 78, y: 66, d: 0.15 },
  { x: 50, y: 16, d: 0.45 },
  { x: 60, y: 80, d: 0.75 },
];

/** Talking target, opened by clicking ミケ / タマ / たぬきち in the 3D scene. */
export type LifeTalking = 'mike' | 'tama' | 'tanuki' | null;

export default function LifeOverlay({
  state,
  dispatch,
  talking,
  setTalking,
  roadMode,
  setRoadMode,
  roadErase,
  setRoadErase,
}: {
  state: GameState;
  dispatch: (action: PolicyAction) => void;
  talking: LifeTalking;
  setTalking: (t: LifeTalking) => void;
  roadMode: boolean;
  setRoadMode: (v: boolean | ((m: boolean) => boolean)) => void;
  roadErase: boolean;
  setRoadErase: (v: boolean | ((m: boolean) => boolean)) => void;
}) {
  const [invOpen, setInvOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [day4Elapsed, setDay4Elapsed] = useState(0);
  const [day3Elapsed, setDay3Elapsed] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const life = state.life;

  // DAY4: after ~25s of searching without finding the lost item, nudge harder.
  const searching = life.active && life.day === 4 && !life.hasLostItem;
  useEffect(() => {
    if (!searching) return;
    const start = Date.now();
    const id = setInterval(() => setDay4Elapsed(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [searching]);

  // DAY7 ending cinematic: drive the beats on a timer so the fireworks show
  // before the 村レベル2 modal, and シロ's arrival lingers before free play.
  const fest = life.festivalPhase;
  const festivalActive = fest === 'fireworks' || fest === 'level2' || fest === 'shiro';
  useEffect(() => {
    if (fest === 'fireworks') {
      const id = setTimeout(() => dispatch({ type: 'LIFE_FESTIVAL_NEXT' }), 1600);
      return () => clearTimeout(id);
    }
    if (fest === 'shiro') {
      const id = setTimeout(() => dispatch({ type: 'LIFE_FESTIVAL_NEXT' }), 3400);
      return () => clearTimeout(id);
    }
  }, [fest, dispatch]);

  // DAY6: after the road connects, let the arrival 演出 (queue + popups) play for
  // a beat before the explanation modal appears.
  const roadJustConnected =
    life.day === 6 && life.roadDone && life.dayDone && life.notice === null;
  useEffect(() => {
    if (!roadJustConnected) return;
    const id = setTimeout(() => dispatch({ type: 'LIFE_ROAD_NOTICE' }), 1800);
    return () => clearTimeout(id);
  }, [roadJustConnected, dispatch]);

  // Force road-build mode OFF once the DAY6 mission completes or DAY7 begins, so
  // the grid + road UI disappear and the player is back in normal interaction.
  // (Deferred via setTimeout to keep setState out of the synchronous effect body.)
  const roadModeShouldEnd = (life.day === 6 && life.roadDone) || life.day === 7;
  useEffect(() => {
    if (!roadModeShouldEnd) return;
    const id = setTimeout(() => {
      setRoadMode(false);
      setRoadErase(false);
    }, 0);
    return () => clearTimeout(id);
  }, [roadModeShouldEnd, setRoadMode, setRoadErase]);

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
      <div className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-black/25 p-4">
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
      {/* ---- Camera-control help: collapsible button (bottom-right) ---- */}
      <div className="pointer-events-auto absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
        {helpOpen && (
          <div className="animate-pop w-52 rounded-2xl border-2 border-amber-300 bg-[#fffdf7]/97 p-3 text-xs font-bold leading-relaxed text-amber-900 shadow-xl">
            <div className="mb-1 text-sm font-black text-amber-800">🎥 そうさ方法</div>
            🖱️ 地面クリック：移動
            <br />
            🖱️ 右ドラッグ：視点を回す
            <br />
            🌀 ホイール：ズーム
            <br />
            ⌨️ Q / E：左右に回す
            <br />
            ⌨️ C：主人公に戻す
          </div>
        )}
        <button
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          className="btn-press rounded-full border-2 border-amber-300 bg-[#fffdf7]/95 px-3 py-1.5 text-xs font-black text-amber-800 shadow-lg transition hover:bg-amber-50"
        >
          {helpOpen ? '✕ とじる' : '❓ そうさ'}
        </button>
      </div>

      {/* ---- Big "DAY N" splash. Sits ABOVE the day-intro/celebration notices
              (z-66) with its own fading backdrop so it's always visible, then
              fades to reveal the notice. Keyed by day so it replays each day. ---- */}
      {life.day <= 7 && (
        <div
          key={life.day}
          className="day-splash-screen pointer-events-none absolute inset-0 z-[69] flex items-center justify-center overflow-hidden"
        >
          <div className="absolute inset-0 bg-black/25" />
          {/* twinkling sparkles around the title */}
          {SPLASH_SPARKLES.map((s, i) => (
            <span
              key={i}
              className="splash-sparkle absolute text-3xl"
              style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }}
            >
              ✨
            </span>
          ))}
          <div className="day-splash relative text-center">
            <div className="text-7xl font-black tracking-wider text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.65)]">
              ✨ DAY {life.day} ✨
            </div>
            <div className="mt-3 text-3xl font-black text-amber-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
              {DAY_SUBTITLE[life.day]}
            </div>
          </div>
        </div>
      )}

      {/* ---- DAY1 opening conversation (たぬきち導入・初回のみ) ---- */}
      {life.day === 1 && !life.day1IntroDone && life.playerName !== '' && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[67] flex justify-center bg-gradient-to-t from-black/40 to-transparent p-3 pt-12">
          <div className="animate-pop w-full max-w-2xl rounded-3xl border-4 border-amber-300 bg-[#fffdf7]/98 p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="text-5xl drop-shadow">🦝</span>
              <span className="text-base font-black text-amber-700">たぬきち</span>
            </div>
            <div className="mt-2 min-h-[3.5rem] text-lg font-black leading-relaxed text-amber-950">
              {DAY1_INTRO_LINES[introStep].replace('{name}', life.playerName)}
            </div>
            <button
              type="button"
              onClick={() => {
                if (introStep < DAY1_INTRO_LINES.length - 1) setIntroStep((s) => s + 1);
                else dispatch({ type: 'LIFE_DAY1_INTRO_DONE' });
              }}
              className="tutorial-cta btn-press mt-3 w-full rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 py-2.5 text-base font-black text-white shadow-lg"
            >
              {introStep < DAY1_INTRO_LINES.length - 1
                ? `▶ つぎへ（${introStep + 1}/${DAY1_INTRO_LINES.length}）`
                : '🍄 きのこを集めにいく'}
            </button>
          </div>
        </div>
      )}

      {/* ---- DAY1 operation hints (after the intro, until the day is done) ---- */}
      {life.day === 1 && life.day1IntroDone && !life.dayDone && (
        <div className="pointer-events-none absolute inset-x-0 top-44 flex flex-col items-center gap-1.5">
          <div className="rounded-2xl border-2 border-emerald-300 bg-[#fffdf7]/95 px-4 py-1.5 text-sm font-black text-emerald-800 shadow">
            🖱 地面をクリックすると移動できるニャ
          </div>
          <div className="rounded-2xl border-2 border-amber-300 bg-[#fffdf7]/95 px-4 py-1.5 text-sm font-black text-amber-800 shadow">
            🍄 きのこをクリックすると拾えるニャ
          </div>
        </div>
      )}

      {/* ---- Top-left HUD: cash / day / objective / inventory ---- */}
      <div className="pointer-events-auto absolute left-3 top-3 w-72 rounded-3xl border-4 border-amber-300 bg-[#fffdf7]/95 p-3 shadow-xl">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex min-w-[120px] items-center gap-1.5 whitespace-nowrap rounded-2xl bg-gradient-to-b from-yellow-100 to-amber-100 px-2.5 py-1">
            <span className="text-xl">👛</span>
            <span className="whitespace-nowrap text-lg font-black tabular-nums text-amber-900">
              {cash.toLocaleString()}ニャル
            </span>
          </div>
          <div className="whitespace-nowrap rounded-2xl bg-sky-100 px-2.5 py-1 text-sm font-black text-sky-800">
            {TIME_EMOJI[life.time]} {campaign ? `DAY${life.day}` : `${life.day}日目`}
          </div>
          {life.liveliness > 0 && (
            <div
              className="whitespace-nowrap rounded-2xl bg-rose-100 px-2.5 py-1 text-sm font-black text-rose-700"
              title="村のにぎわい"
            >
              🎪 にぎわい {life.liveliness}
            </div>
          )}
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
      {life.sceneMode === 'village' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-2">
          {life.event && (
            <div className="animate-pop rounded-2xl border-4 border-sky-300 bg-white/95 px-4 py-2 text-sm font-black text-sky-800 shadow-lg">
              {life.event}
            </div>
          )}
          {searching && day4Elapsed > 15000 && (
            <div className="rounded-2xl border-4 border-rose-300 bg-white/95 px-4 py-2 text-sm font-black text-rose-700 shadow-lg">
              {day4Elapsed > 30000
                ? '🔦 光の柱が立っているところニャ！'
                : '🌿 広場のまわりの草地でキラッと光ってるニャ！'}
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
          {life.active && ((life.day === 6 && !life.roadDone) || life.day >= 8) && (
            roadMode ? (
              <div className="pointer-events-auto flex flex-col items-center gap-1.5">
                <div className="rounded-2xl border-2 border-amber-300 bg-[#fffdf7]/95 px-4 py-1.5 text-center text-xs font-black text-amber-900 shadow">
                  🖱️ マップをクリック／ドラッグして道をつくるニャ（{LIFE_ROAD_COST}ニャル/マス）
                  <br />
                  🏛️ 道路予算：{life.roadBudget}ニャル
                  {life.roadBudget === 0 && <span className="text-amber-700">（使い切ったら所持金から払うニャ）</span>}
                </div>
                {life.day === 6 && !life.roadDone && (() => {
                  const connected = lifeRoadConnected(state.roads);
                  const short = connected && state.roads.length < MIN_ROAD_TILES;
                  const need = MIN_ROAD_TILES - state.roads.length;
                  return (
                    <div
                      className={`max-w-xs rounded-2xl border-2 px-4 py-1 text-center text-xs font-black shadow ${
                        connected && !short
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                          : short
                            ? 'border-amber-400 bg-amber-50 text-amber-800'
                            : 'border-rose-300 bg-rose-50 text-rose-700'
                      }`}
                    >
                      {connected && !short
                        ? '✅ 屋台とスープ鍋がつながったニャ！'
                        : short
                          ? `⚠️ もう少し道をつなげるニャ（あと${need}マス）。これだと板を置いただけニャ、猫が歩ける道にするニャ`
                          : '❌ まだ屋台とスープ鍋がつながっていないニャ'}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRoadErase(false)}
                    className={`btn-press rounded-xl border-2 px-4 py-1.5 text-sm font-black transition ${
                      !roadErase ? 'border-amber-500 bg-amber-400 text-white' : 'border-amber-300 bg-white text-amber-800'
                    }`}
                  >
                    🛤️ 道をおく
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoadErase(true)}
                    className={`btn-press rounded-xl border-2 px-4 py-1.5 text-sm font-black transition ${
                      roadErase ? 'border-rose-500 bg-rose-400 text-white' : 'border-rose-300 bg-white text-rose-700'
                    }`}
                  >
                    🧽 道をけす
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRoadMode(false); setRoadErase(false); }}
                    className="btn-press rounded-xl border-2 border-slate-300 bg-white px-4 py-1.5 text-sm font-black text-slate-700"
                  >
                    ✓ おわる
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRoadMode(true)}
                className={`pointer-events-auto btn-press rounded-2xl border-4 border-yellow-400 bg-gradient-to-b from-emerald-400 to-emerald-600 px-7 py-3 text-lg font-black text-white shadow-xl ${
                  life.roadDone ? '' : 'tutorial-cta'
                }`}
              >
                🛤️ 道を作る
              </button>
            )
          )}
          {!festivalActive && (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => dispatch({ type: 'LIFE_ADVANCE_DAY' })}
              className={`pointer-events-auto btn-press rounded-2xl border-4 border-yellow-400 bg-gradient-to-b from-amber-400 to-orange-500 px-8 py-3 text-lg font-black text-white shadow-xl transition enabled:hover:from-amber-300 enabled:hover:to-orange-400 disabled:opacity-50 ${
                campaign && life.dayDone ? 'tutorial-cta' : ''
              }`}
            >
              {advanceLabel}
            </button>
          )}
        </div>
      )}

      {/* ---- DAY7: 新住民シロ arrival banner (non-dimming, over the 3D pan) ---- */}
      {fest === 'shiro' && (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-[60] flex justify-center px-4">
          <div className="animate-pop rounded-3xl border-4 border-sky-300 bg-white/95 px-6 py-3 text-center shadow-2xl">
            <div className="text-2xl font-black text-sky-700">🐱 新住民シロが引っ越してきたニャ！</div>
            <div className="mt-1 text-sm font-bold text-sky-700">あたらしいなかまが村にやってきたニャ〜</div>
          </div>
        </div>
      )}

      {/* ---- Tent interior screen ---- */}
      {life.sceneMode === 'interior' && <TentInterior life={life} dispatch={dispatch} />}

      {/* ---- ミケ ---- */}
      {talking === 'mike' && (
        <Dialog onClose={close} avatar="🐱" name="ミケ">
          {life.day === 1 ? (
            <p>まずはマップのきのこを3つ集めてくるニャ！</p>
          ) : life.day === 5 && !life.shopOpen ? (
            <>
              <p>スープ屋を開きたいニャ！木材{STALL_WOOD}個と{STALL_COST}ニャルが必要ニャ。どうやって出してくれるニャ？</p>
              <p className="mt-1 text-sm text-amber-600">木材 {life.inventory.wood}/{STALL_WOOD} ・ 所持金 {cash}ニャル</p>
              {(() => {
                const cant = life.inventory.wood < STALL_WOOD || cash < STALL_COST;
                const build = (choice: 'invest' | 'lend' | 'gift') => {
                  dispatch({ type: 'LIFE_BUILD_STALL', choice });
                  close();
                };
                return (
                  <div className="mt-2 flex flex-col gap-2">
                    <StallChoiceBtn
                      disabled={cant}
                      icon="💰"
                      title="出資する"
                      desc="成長を応援して、利益の一部をもらう（毎日+20ニャル）"
                      onClick={() => build('invest')}
                    />
                    <StallChoiceBtn
                      disabled={cant}
                      icon="🤝"
                      title="貸す"
                      desc="あとで少し多く返してもらう（5日で合計220ニャル）"
                      onClick={() => build('lend')}
                    />
                    <StallChoiceBtn
                      disabled={cant}
                      icon="🎁"
                      title="プレゼントする"
                      desc="お金は戻らないけど、仲良し度が大きく上がる＋お礼"
                      onClick={() => build('gift')}
                    />
                  </div>
                );
              })()}
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
            <p>広場のあたりの草地で落とし物（🔔）をした気がするニャ…探して拾ってきてほしいニャ。</p>
          ) : (
            <p>こんにちはニャ！（💗 親密度 Lv {life.intimacy['3'] ?? 1}）</p>
          )}
        </Dialog>
      )}

      {/* ---- たぬきち ---- */}
      {talking === 'tanuki' && (
        <Dialog onClose={close} avatar="🦝" name="たぬきち" tone="sky">
          {!life.shopUnlocked ? (
            <p>家具店はDAY3で開くニャ。それまで待っててほしいニャ。</p>
          ) : life.day === 7 && !life.dayDone && cash < DAY7_REPAY ? (
            <>
              <p>ニャルが足りないみたいニャ。どうするニャ？</p>
              <p className="mt-1 text-sm font-bold text-amber-700">所持金 {cash} / {DAY7_REPAY}ニャル</p>
              <DialogButton onClick={() => { dispatch({ type: 'LIFE_RESCUE_WORK' }); close(); }}>
                💪 もう1日働いてから返す（採集＋お駄賃）
              </DialogButton>
              <DialogButton
                disabled={!life.shopOpen}
                onClick={() => { dispatch({ type: 'LIFE_RESCUE_BORROW' }); close(); }}
              >
                🐱 ミケから売上を前借りする{life.shopOpen ? '' : '（屋台が必要ニャ）'}
              </DialogButton>
              <DialogButton
                disabled={life.rescueUsed}
                onClick={() => { dispatch({ type: 'LIFE_RESCUE_WAIT' }); close(); }}
              >
                ⏳ 返済を少し待ってもらう{life.rescueUsed ? '（使用済み）' : '（次回+50ニャル）'}
              </DialogButton>
            </>
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

      {/* ---- Objective-complete celebration (dayDone + notice) ---- */}
      {life.notice && life.dayDone && (
        <div className="pointer-events-auto absolute inset-0 z-[66] flex items-center justify-center overflow-hidden bg-black/25 p-4">
          {CELEBRATE_BITS.map((b, i) => (
            <span
              key={i}
              className="confetti-bit absolute text-2xl"
              style={{ left: `${b.x}%`, animationDelay: `${b.d}s` }}
            >
              {b.e}
            </span>
          ))}
          <div className="animate-pop max-w-sm rounded-3xl border-4 border-yellow-300 bg-[#fffdf7] p-7 text-center shadow-2xl">
            {fest === 'level2' ? (
              <>
                <div className="text-5xl font-black leading-tight text-amber-600 drop-shadow">🎆</div>
                <div className="mt-1 text-3xl font-black leading-tight text-rose-500">NekoEcon村 レベル2！</div>
                <div className="mt-2 text-base font-black leading-relaxed text-amber-900">
                  テント代を返して、村が大きくなったニャ！
                  <br />
                  新しい区画と住民がやってくるニャ！
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'LIFE_FESTIVAL_NEXT' })}
                  className="tutorial-cta btn-press mt-5 w-full rounded-2xl bg-gradient-to-b from-rose-400 to-pink-500 py-3 text-lg font-black text-white shadow-lg"
                >
                  ▶ つづき
                </button>
              </>
            ) : (
              <>
                <div className="text-4xl font-black text-amber-600">🎉 目的達成！</div>
                <div className="mt-2 whitespace-pre-line text-base font-black leading-relaxed text-amber-900">
                  {life.notice}
                </div>
                {life.reward > 0 && (
                  <div className="mt-3 inline-block rounded-full bg-amber-100 px-4 py-1.5 text-lg font-black text-amber-700">
                    報酬：{life.reward} ニャル
                  </div>
                )}
                <div className="mt-2 text-sm font-bold text-amber-700">🐱🐈 みんなが喜んでいるニャ！</div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'LIFE_ADVANCE_DAY' })}
                  className="tutorial-cta btn-press mt-5 w-full rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 py-3 text-lg font-black text-white shadow-lg"
                >
                  ▶ 次の日へ
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---- Plain story notice (intros etc.) ---- */}
      {life.notice && !life.dayDone && (
        <div className="pointer-events-auto absolute inset-0 z-[66] flex items-center justify-center bg-black/25 p-4">
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
  // A dedicated conversation panel pinned to the bottom of the screen, clear of
  // the floating NPC name labels (which are dimmed while a dialog is open). The
  // light bottom gradient catches stray clicks without hiding the 3D scene.
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[61] flex justify-center bg-gradient-to-t from-black/35 to-transparent p-3 pt-10">
      <div className={`animate-pop w-full max-w-2xl rounded-3xl border-4 ${ring} bg-[#fffdf7]/97 p-5 shadow-2xl`}>
        <div className="flex items-center gap-3">
          <span className="text-5xl drop-shadow">{avatar}</span>
          <span className="text-base font-black text-amber-700">{name}</span>
          <button
            type="button"
            onClick={onClose}
            className="btn-press ml-auto rounded-full border-2 border-amber-200 bg-white px-2.5 py-0.5 text-xs font-bold text-amber-700"
          >
            ✕ とじる
          </button>
        </div>
        <div className="mt-2 text-lg font-black leading-relaxed text-amber-950">{children}</div>
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

/** A DAY5 financing choice (出資 / 貸付 / 贈与) — all three shown equal, no 推奨. */
function StallChoiceBtn({
  icon,
  title,
  desc,
  onClick,
  disabled,
}: {
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="btn-press relative w-full rounded-2xl border-2 border-amber-200 bg-white px-3 py-2.5 text-left transition enabled:hover:bg-amber-50 disabled:opacity-40"
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl drop-shadow">{icon}</span>
        <span className="text-base font-black text-amber-900">{title}</span>
      </div>
      <p className="mt-0.5 text-xs font-bold leading-snug text-amber-700">{desc}</p>
    </button>
  );
}

/** A small toolbar button for the tent-interior controls. */
function ToolBtn({
  children,
  onClick,
  disabled,
  active,
  highlight,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`btn-press rounded-xl border-2 px-3 py-1.5 text-xs font-black transition disabled:opacity-40 ${
        highlight ? 'tutorial-cta ' : ''
      }${active ? 'border-amber-500 bg-amber-400 text-white' : 'border-amber-300 bg-[#fffdf7] text-amber-800'}`}
    >
      {children}
    </button>
  );
}

const ROOM_GRID = 7; // 7×7 room

/** Tent-interior screen: a small decorated room you furnish on a grid. */
function TentInterior({
  life,
  dispatch,
}: {
  life: GameState['life'];
  dispatch: (action: PolicyAction) => void;
}) {
  const [selKind, setSelKind] = useState<FurnitureKind | null>(null); // owned piece to place
  const [selId, setSelId] = useState<string | null>(null); // placed piece selected
  const [placeRot, setPlaceRot] = useState(0);

  const counts = life.ownedFurniture.reduce<Partial<Record<FurnitureKind, number>>>((m, k) => {
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});
  const kinds = Object.keys(counts) as FurnitureKind[];
  const itemAt = (gx: number, gy: number) => life.interior.find((it) => it.gx === gx && it.gy === gy);
  const placing = selKind !== null;
  const gridActive = placing || selId !== null;
  const selName = selKind ? FURNITURE_META[selKind].name : '';

  // R key rotates the selected (or to-be-placed) furniture.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r') return;
      if (selId) dispatch({ type: 'LIFE_ROTATE_INTERIOR', id: selId });
      else if (selKind) setPlaceRot((r) => (r + 90) % 360);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selId, selKind, dispatch]);

  const rotate = () => {
    if (selId) dispatch({ type: 'LIFE_ROTATE_INTERIOR', id: selId });
    else if (selKind) setPlaceRot((r) => (r + 90) % 360);
  };
  const removeSel = () => {
    if (selId) {
      dispatch({ type: 'LIFE_REMOVE_INTERIOR', id: selId });
      setSelId(null);
    }
  };
  const onCell = (gx: number, gy: number) => {
    const it = itemAt(gx, gy);
    if (it) {
      setSelId(it.id);
      setSelKind(null);
      return;
    }
    if (selKind) {
      dispatch({ type: 'LIFE_PLACE_INTERIOR', kind: selKind, gx, gy, rot: placeRot });
      if ((counts[selKind] ?? 0) <= 1) setSelKind(null);
      return;
    }
    if (selId) dispatch({ type: 'LIFE_MOVE_INTERIOR', id: selId, gx, gy });
  };

  const cells: { gx: number; gy: number }[] = [];
  for (let gy = 0; gy < ROOM_GRID; gy++) for (let gx = 0; gx < ROOM_GRID; gx++) cells.push({ gx, gy });

  return (
    <div className="pointer-events-auto fixed inset-0 z-[64] flex flex-col items-center overflow-auto bg-[#241a12] p-3">
      {/* Header + toolbar */}
      <div className="flex w-[min(86vw,520px)] items-center justify-between gap-2">
        <h2 className="text-lg font-black text-amber-100">🏠 {life.playerName}の部屋</h2>
        <div className="flex flex-wrap justify-end gap-1.5">
          <ToolBtn active={placing} disabled={kinds.length === 0} onClick={() => { setSelKind(kinds[0] ?? null); setSelId(null); }}>
            🪑 配置する
          </ToolBtn>
          <ToolBtn disabled={!gridActive} onClick={rotate}>🔄 回転(R)</ToolBtn>
          <ToolBtn disabled={!selId} onClick={removeSel}>📦 しまう</ToolBtn>
          <ToolBtn
            highlight={life.day === 3 && life.interior.length > 0}
            onClick={() => dispatch({ type: 'LIFE_EXIT_TENT' })}
          >
            🚪 外に出る
          </ToolBtn>
        </div>
      </div>

      {/* Status hint */}
      <div className="mt-1 text-center text-xs font-bold text-amber-200/90">
        {placing
          ? `🟩 緑のマスをクリックして「${selName}」を配置（🔄 で回転）`
          : selId
            ? '✋ 移動は別のマスをクリック ／ 🔄 回転 ／ 📦 しまう'
            : life.day === 3 && life.dayDone
              ? '✅ 飾れたニャ！「🚪 外に出る」で村へもどろう'
              : life.day === 3 && life.interior.length === 0
                ? '🪑「配置する」か、持ち家具を選んで飾ろう'
                : '🛋️ 家具を選んで飾ろう。置いた家具はクリックで選べるニャ'}
      </div>

      {/* Room: back wall (window/curtain/shelf/lamp/door) + wood-plank floor grid */}
      <div className="relative mt-2 w-[min(86vw,520px)] overflow-hidden rounded-2xl border-4 border-[#5b3f26] shadow-2xl">
        <div className="room-wall relative h-20">
          <div className="absolute left-6 top-3 h-12 w-20 rounded-md border-[3px] border-white bg-gradient-to-b from-[#bfe3ff] to-[#eaf6ff]">
            <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white" />
            <div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-white" />
          </div>
          <div className="absolute left-3 top-2 h-14 w-2.5 rounded bg-[#d98aa6]" /> {/* curtain */}
          <div className="absolute left-[100px] top-2 h-14 w-2.5 rounded bg-[#d98aa6] " />
          <div className="absolute left-1/2 top-8 flex h-2.5 w-24 items-end justify-around rounded-sm bg-[#8a5a2b]">
            <span className="-mt-4 text-sm leading-none">🪴</span>
            <span className="-mt-4 text-sm leading-none">📚</span>
            <span className="-mt-4 text-sm leading-none">⏰</span>
          </div>
          <div className="absolute right-20 top-2 text-xl">💡</div> {/* wall lamp */}
          <div className="absolute bottom-0 right-3 flex h-16 w-11 items-end justify-center rounded-t-2xl border-2 border-[#3f2a18] bg-[#6b4a2b] pb-1 text-[10px] font-black text-amber-100">
            出入口
          </div>
        </div>
        <div
          className="room-floor grid"
          style={{
            gridTemplateColumns: `repeat(${ROOM_GRID}, 1fr)`,
            gridTemplateRows: `repeat(${ROOM_GRID}, 1fr)`,
            aspectRatio: '1 / 1',
          }}
        >
          {cells.map(({ gx, gy }) => {
            const it = itemAt(gx, gy);
            const isSel = it !== undefined && it.id === selId;
            const tone = gridActive ? (it ? 'room-cell-no' : 'room-cell-ok') : '';
            return (
              <div
                key={`${gx}-${gy}`}
                onClick={() => onCell(gx, gy)}
                className={`room-cell ${gridActive ? 'room-cell-grid' : ''} ${tone} ${isSel ? 'room-cell-sel' : ''}`}
              >
                {it && (
                  <span key={it.id} className="room-furn furn-pop" style={{ transform: `rotate(${it.rot}deg)` }}>
                    {FURNITURE_META[it.kind].icon}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Owned-furniture tray */}
      <div className="mt-2 w-[min(86vw,520px)] rounded-2xl bg-[#fffdf7]/95 p-2">
        <div className="text-xs font-black text-amber-800">🎒 持っている家具（選んで配置）</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {kinds.length === 0 && (
            <span className="text-xs font-bold text-amber-700">
              家具がないニャ。たぬきち商店で買ってこよう
            </span>
          )}
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setSelKind(k); setSelId(null); }}
              className={`btn-press rounded-xl border-2 px-2.5 py-1 text-xs font-black transition ${
                selKind === k
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
