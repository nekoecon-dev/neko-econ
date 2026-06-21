'use client';

import { useState } from 'react';
import type { GameState, PolicyAction } from '@/types/game';
import {
  DIVIDEND_AFTER_INVEST,
  DIVIDEND_AFTER_ROADS,
  TUTORIAL_INVEST_COST,
  TUTORIAL_RATE_STEP,
  TUTORIAL_REPAY_AMOUNT,
} from '@/lib/engine/tutorial';

// The overlay drives its own presentation steps; engine `phase` changes happen
// in lock-step via dispatch so the paused simulation + scripted economy stay in
// sync with what the player sees.
type View =
  | 'intro' // opening card
  | 'm1' // mission 1 — talk to ミケ
  | 'm1talk' // mission 1 — ミケ's investment proposal (conversation)
  | 'm1edu' // mission 1 — 投資 explanation
  | 'm2' // mission 2 — たぬきち asks for the 石畳
  | 'm2edu' // mission 2 — 物流 explanation
  | 'm3' // mission 3 — たぬきち asks to raise the rate
  | 'm3edu' // mission 3 — 金利 explanation
  | 'repay' // repayment day — たぬきち collects 1,000CC
  | 'done'; // all done → free play

const viewForPhase: Record<GameState['tutorial']['phase'], View> = {
  intro: 'intro',
  mission1: 'm1',
  mission2: 'm2',
  mission3: 'm3',
  repayment: 'repay',
  done: 'done',
};

// Short "現在ミッション" caption per view, for the status HUD.
const MISSION_LABEL: Partial<Record<View, string>> = {
  intro: '村を救おう',
  m1: 'ミケに話しかけよう',
  m1talk: 'ミケに投資しよう',
  m1edu: 'ミケに投資しよう',
  m2: '石畳の道を敷こう',
  m2edu: '石畳の道を敷こう',
  m3: '金利を調整しよう',
  m3edu: '金利を調整しよう',
  repay: '借金を返済しよう',
};

/** A big, friendly speech bubble with an emoji avatar. */
function SpeechBubble({
  avatar,
  speaker,
  children,
  tone = 'amber',
}: {
  avatar: string;
  speaker: string;
  children: React.ReactNode;
  tone?: 'amber' | 'sky';
}) {
  const ring = tone === 'sky' ? 'border-sky-300' : 'border-amber-300';
  return (
    <div className={`flex items-start gap-3 rounded-3xl border-4 ${ring} bg-white/95 px-5 py-4 shadow-2xl`}>
      <span className="text-6xl drop-shadow">{avatar}</span>
      <div className="min-w-0">
        <div className="text-sm font-black text-amber-600">{speaker}</div>
        <p className="mt-1 text-lg font-black leading-relaxed text-amber-900">{children}</p>
      </div>
    </div>
  );
}

/** The yellow blinking call-to-action the player must press for each mission. */
function CtaButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tutorial-cta btn-press rounded-2xl border-4 border-yellow-400 bg-gradient-to-b from-amber-400 to-orange-500 px-7 py-3 text-lg font-black text-white shadow-xl transition hover:from-amber-300 hover:to-orange-400"
    >
      {children}
    </button>
  );
}

/** A centred "💡 explanation" popup, with a 次へ button. */
function EduPopup({
  title,
  lesson,
  notes,
  onNext,
}: {
  title: string;
  lesson: string;
  notes: string[];
  onNext: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[71] flex items-center justify-center bg-black/45 p-4">
      <div className="animate-pop max-w-md rounded-3xl border-4 border-amber-300 bg-[#fffdf7] p-6 text-center shadow-2xl">
        <div className="text-5xl">💡</div>
        <h3 className="mt-2 text-xl font-black text-amber-900">{title}</h3>
        <p className="mt-2 text-base font-bold leading-relaxed text-amber-800">{lesson}</p>
        <div className="mt-3 flex flex-col gap-1.5">
          {notes.map((n) => (
            <div
              key={n}
              className="rounded-xl bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-700"
            >
              {n}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onNext}
          className="btn-press mt-5 w-full rounded-2xl bg-amber-500 py-2.5 text-base font-black text-white transition hover:bg-amber-600"
        >
          次へ ▶
        </button>
      </div>
    </div>
  );
}

export default function TutorialOverlay({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (action: PolicyAction) => void;
}) {
  const [view, setView] = useState<View>(() => viewForPhase[state.tutorial.phase]);

  // The overlay only exists while the tutorial is running.
  if (!state.tutorial.active) return null;

  const skip = () => dispatch({ type: 'TUTORIAL_SKIP' });
  const cash = Math.round(state.player.cash);
  const loan = Math.round(state.player.loan);
  const repayIn = Math.max(0, state.repayDueTick - state.tick);

  // Small skip button, top-right, present throughout the tutorial.
  const SkipButton = (
    <button
      type="button"
      onClick={skip}
      className="btn-press pointer-events-auto absolute right-3 top-3 z-[73] rounded-full border-2 border-white/70 bg-black/40 px-3 py-1 text-xs font-bold text-white/90 backdrop-blur transition hover:bg-black/60"
    >
      スキップ ▶▶
    </button>
  );

  // Always-on status HUD: the only numbers the new player needs to watch
  // (所持金 / 返済まで / 借金残高 / 現在ミッション).
  const missionLabel = MISSION_LABEL[view];
  const StatusHud = missionLabel ? (
    <div className="pointer-events-none absolute left-3 top-20 z-[72] w-48 rounded-3xl border-4 border-amber-300 bg-[#fffdf7]/95 p-3 text-amber-900 shadow-xl">
      <div className="flex items-center justify-between text-sm font-black">
        <span className="text-amber-600">👛 所持金</span>
        <span className="tabular-nums">{cash.toLocaleString()} CC</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm font-black">
        <span className="text-amber-600">⏰ 返済まで</span>
        <span className="tabular-nums">{repayIn} tick</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm font-black">
        <span className="text-amber-600">🦝 借金</span>
        <span className="tabular-nums">{loan.toLocaleString()} CC</span>
      </div>
      <div className="mt-2 rounded-xl bg-amber-100 px-2.5 py-1.5 text-center text-xs font-black text-amber-800">
        🎯 {missionLabel}
      </div>
    </div>
  ) : null;

  // ---- Intro card -----------------------------------------------------------
  if (view === 'intro') {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/85 p-4">
        {SkipButton}
        <div className="animate-pop w-full max-w-lg rounded-3xl border-4 border-amber-300 bg-[#fffdf7] px-8 py-8 text-center shadow-2xl">
          <div className="text-6xl">🍲🔥</div>
          <h2 className="mt-3 text-2xl font-black text-amber-900">火の消えかけたネコ村へようこそ</h2>
          <p className="mt-3 text-base font-bold leading-relaxed text-amber-800">
            あなたは借金を抱えた新しい村人ニャ。
            <br />
            村のシンボル・巨大スープ鍋の火を復活させ、
            <br />
            <span className="font-black text-rose-600">18tick以内にネコ銀行へ1,000CC返済</span>
            するのが目標ニャ！
          </p>
          <div className="mt-4 flex flex-col gap-1.5 text-sm font-black text-amber-700">
            <div className="rounded-xl bg-amber-100 px-3 py-1.5">👛 所持金 606CC ／ 🦝 借金 9,000CC</div>
          </div>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'TUTORIAL_START' });
              setView('m1');
            }}
            className="btn-press mt-6 rounded-2xl bg-amber-400 px-8 py-3 text-lg font-black text-amber-950 shadow-lg transition hover:bg-amber-300"
          >
            ▶ はじめる！
          </button>
        </div>
      </div>
    );
  }

  // ---- Education popups ------------------------------------------------------
  if (view === 'm1edu') {
    return (
      <>
        {SkipButton}
        <EduPopup
          title="投資ってなに？"
          lesson="投資とは、事業の成長を応援してお金を出し、利益を受け取ることニャ。"
          notes={[
            '🍲 ミケのスープ屋オープン！タマが雇われた',
            `💰 毎tick +${DIVIDEND_AFTER_INVEST}CC の配当が入ります`,
          ]}
          onNext={() => setView('m2')}
        />
      </>
    );
  }
  if (view === 'm2edu') {
    return (
      <>
        {SkipButton}
        <EduPopup
          title="物流ってなに？"
          lesson="物流とは、モノや人の流れをよくして経済を回すことニャ。道がつながると売上が伸びるニャ。"
          notes={[
            '🛤️ 石畳が開通！スープの売上が上昇',
            `💰 配当が +${DIVIDEND_AFTER_INVEST}CC → +${DIVIDEND_AFTER_ROADS}CC に増加`,
          ]}
          onNext={() => setView('m3')}
        />
      </>
    );
  }
  if (view === 'm3edu') {
    return (
      <>
        {SkipButton}
        <EduPopup
          title="金利ってなに？"
          lesson="金利とは、お金を借りる／預けるコストニャ。上げると物価は落ち着くけど、借金の利息も増えるニャ。"
          notes={['📉 インフレ率が落ち着きました', '😈 ただしローンの利息は少し増えたニャ']}
          onNext={() => setView('repay')}
        />
      </>
    );
  }

  // ---- Completion ------------------------------------------------------------
  if (view === 'done') {
    const unlocked = state.villageLevel >= 2;
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
        {SkipButton}
        <div className="animate-pop max-w-md rounded-3xl border-4 border-emerald-400 bg-[#fffdf7] p-7 text-center shadow-2xl">
          <div className="text-6xl">{unlocked ? '🎉' : '🙏'}</div>
          <h3 className="mt-3 text-2xl font-black text-emerald-700">
            {unlocked ? 'チュートリアル完了！' : '救済されたニャ…'}
          </h3>
          {unlocked ? (
            <div className="mt-2 flex flex-col gap-1.5 text-sm font-bold text-emerald-700">
              <div className="rounded-xl bg-emerald-100 px-3 py-1.5">🏘️ 村レベル2を解放！区画が広がった</div>
              <div className="rounded-xl bg-emerald-100 px-3 py-1.5">🐱 新住民シロが引っ越してきた</div>
              <div className="rounded-xl bg-emerald-100 px-3 py-1.5">📈 株式市場がオープン！</div>
            </div>
          ) : (
            <p className="mt-2 text-base font-bold leading-relaxed text-amber-800">
              たぬきち「今回は待つニャ。でも次は本当に差し押さえるニャ」
              <br />
              次の返済額が増えたニャ。村を立て直そうニャ！
            </p>
          )}
          <button
            type="button"
            onClick={() => dispatch({ type: 'TUTORIAL_FINISH' })}
            className="btn-press mt-5 w-full rounded-2xl bg-emerald-500 py-3 text-lg font-black text-white transition hover:bg-emerald-600"
          >
            ▶ フリープレイをはじめる
          </button>
        </div>
      </div>
    );
  }

  // ---- Mission interaction views (village stays visible behind a soft dim) ---
  const missionPanel = (bubble: React.ReactNode, cta: React.ReactNode): React.ReactNode => (
    <div className="fixed inset-0 z-[70] bg-black/35">
      {SkipButton}
      {StatusHud}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 flex flex-col items-center gap-4 px-4">
        <div className="pointer-events-auto w-full max-w-lg">{bubble}</div>
        <div className="pointer-events-auto">{cta}</div>
      </div>
    </div>
  );

  if (view === 'm1') {
    return missionPanel(
      <SpeechBubble avatar="🐱" speaker="ミケ（スープ屋を始めたい）">
        村長さん、はじめましてニャ。ボロ小屋でくすぶってるけど、夢はあるニャ…！
      </SpeechBubble>,
      <CtaButton onClick={() => setView('m1talk')}>🐱 ミケに話しかける</CtaButton>,
    );
  }
  if (view === 'm1talk') {
    return missionPanel(
      <SpeechBubble avatar="🐱" speaker="ミケ">
        {TUTORIAL_INVEST_COST}CCあれば、小さなスープ屋を始められるニャ！
        そしたら毎tick、村長さんに配当を払うニャ！
      </SpeechBubble>,
      <CtaButton
        onClick={() => {
          dispatch({ type: 'TUTORIAL_INVEST' });
          setView('m1edu');
        }}
      >
        🍲 {TUTORIAL_INVEST_COST}CC投資する
      </CtaButton>,
    );
  }
  if (view === 'm2') {
    return missionPanel(
      <SpeechBubble avatar="🦝" speaker="たぬきち" tone="sky">
        スープ屋と鍋が離れてて配達が遅いニャ。
        間に石畳の道を敷けば、猫の足が速くなって売上も伸びるニャ！
      </SpeechBubble>,
      <CtaButton
        onClick={() => {
          dispatch({ type: 'TUTORIAL_LAY_ROADS' });
          setView('m2edu');
        }}
      >
        🛤️ 石畳の道を敷く
      </CtaButton>,
    );
  }
  if (view === 'm3') {
    return missionPanel(
      <SpeechBubble avatar="🦝" speaker="たぬきち" tone="sky">
        お金が回り始めてスープの値段が上がってきたニャ（インフレ率5%超え）。
        金利を上げると物価は落ち着くけど、借金の利息も増えるニャ。
      </SpeechBubble>,
      <CtaButton
        onClick={() => {
          dispatch({ type: 'TUTORIAL_RAISE_RATE' });
          setView('m3edu');
        }}
      >
        ⚙️ 金利を上げる（+{TUTORIAL_RATE_STEP}%）
      </CtaButton>,
    );
  }
  if (view === 'repay') {
    const canPay = state.player.cash >= Math.min(state.repayAmount, state.player.loan);
    return missionPanel(
      <SpeechBubble avatar="🦝" speaker="たぬきち（返済日）" tone="sky">
        村長さん、約束の返済日ニャ。{TUTORIAL_REPAY_AMOUNT}CCをいただくニャ。
        {canPay ? '…ちゃんと用意できてるみたいニャ😼' : '足りないと…困るニャ😾'}
      </SpeechBubble>,
      <CtaButton
        onClick={() => {
          dispatch({ type: 'TUTORIAL_REPAY' });
          setView('done');
        }}
      >
        💰 {TUTORIAL_REPAY_AMOUNT}CC返済する
      </CtaButton>,
    );
  }

  return null;
}
