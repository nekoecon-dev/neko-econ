'use client';

import { useState } from 'react';
import type { GameState, PolicyAction, TutorialPhase } from '@/types/game';
import { TUTORIAL_INVEST_COST, TUTORIAL_REPAY_AMOUNT } from '@/lib/engine/tutorial';

// Modal sub-states layered on top of the phase-driven views (conversation +
// education popups that aren't tracked by the engine `phase`).
type Popup = null | 'talk' | 'investEdu' | 'roadEdu';

// One-line 「現在のミッション」 shown in the status HUD, per stage.
const MISSION_LABEL: Partial<Record<TutorialPhase, string>> = {
  invest: 'ミケに話しかけて、お店に投資しよう',
  advance: '「1日進める」を押して、配当を受け取ろう',
  roads: 'スープ屋と巨大鍋を石畳でつなごう',
  repayWait: '返済日まで進めて1,000ニャルを貯めよう',
  repayment: 'たぬきちに1,000ニャル返済しよう',
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
        <div className="mt-1 text-lg font-black leading-relaxed text-amber-900">{children}</div>
      </div>
    </div>
  );
}

/** The single yellow blinking call-to-action — the one thing to press now. */
function CtaButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tutorial-cta btn-press rounded-2xl border-4 border-yellow-400 bg-gradient-to-b from-amber-400 to-orange-500 px-8 py-4 text-xl font-black text-white shadow-xl transition hover:from-amber-300 hover:to-orange-400"
    >
      {children}
    </button>
  );
}

/** A centred "💡 explanation" popup with a 次へ button. */
function EduPopup({
  title,
  lesson,
  onNext,
}: {
  title: string;
  lesson: string;
  onNext: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4">
      <div className="animate-pop max-w-md rounded-3xl border-4 border-amber-300 bg-[#fffdf7] p-6 text-center shadow-2xl">
        <div className="text-5xl">💡</div>
        <h3 className="mt-2 text-xl font-black text-amber-900">{title}</h3>
        <p className="mt-2 text-base font-bold leading-relaxed text-amber-800">{lesson}</p>
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
  const [popup, setPopup] = useState<Popup>(null);

  // The overlay only exists while the tutorial is running.
  if (!state.tutorial.active) return null;

  const phase = state.tutorial.phase;
  const cash = Math.round(state.player.cash);
  const loan = Math.round(state.player.loan);
  const repayIn = Math.max(0, state.repayDueTick - state.tick);
  const dividend = state.tutorial.dividend;

  const skip = () => dispatch({ type: 'TUTORIAL_SKIP' });

  // Small skip button, top-right, present throughout the tutorial.
  const SkipButton = (
    <button
      type="button"
      onClick={skip}
      className="btn-press pointer-events-auto absolute right-3 top-3 z-[76] rounded-full border-2 border-white/70 bg-black/40 px-3 py-1 text-xs font-bold text-white/90 backdrop-blur transition hover:bg-black/60"
    >
      スキップ ▶▶
    </button>
  );

  // ---- Status HUD: the ≤5 numbers the new player needs ----------------------
  const missionLabel = MISSION_LABEL[phase];
  const StatusHud = missionLabel ? (
    <div className="pointer-events-none absolute left-3 top-20 z-[72] w-52 rounded-3xl border-4 border-amber-300 bg-[#fffdf7]/95 p-3 text-amber-900 shadow-xl">
      <div className="flex items-center justify-between text-sm font-black">
        <span className="text-amber-600">👛 所持金</span>
        <span className="tabular-nums">{cash.toLocaleString()} ニャル</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm font-black">
        <span className="text-amber-600">🦝 借金残高</span>
        <span className="tabular-nums">{loan.toLocaleString()} ニャル</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm font-black">
        <span className="text-amber-600">⏰ 返済まで</span>
        <span className="tabular-nums">あと {repayIn} 日</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm font-black">
        <span className="text-amber-600">💴 次回返済</span>
        <span className="tabular-nums">{state.repayAmount.toLocaleString()} ニャル</span>
      </div>
      <div className="mt-2 rounded-xl bg-amber-100 px-2.5 py-1.5 text-center text-xs font-black leading-snug text-amber-800">
        🎯 {missionLabel}
      </div>
    </div>
  ) : null;

  // ---- Daily 収支レポート (shown once at least one day has been advanced) -----
  const dayReport =
    state.tick > 0 && (phase === 'advance' || phase === 'roads' || phase === 'repayWait') ? (
      <div className="pointer-events-none mb-3 w-60 rounded-2xl border-4 border-emerald-300 bg-[#fffdf7]/95 p-3 text-amber-900 shadow-xl">
        <div className="text-center text-xs font-black text-emerald-600">📅 {state.tick}日目の収支</div>
        <div className="mt-1.5 flex items-center justify-between text-sm font-black">
          <span>今日の配当</span>
          <span className="tabular-nums text-emerald-600">+{dividend} ニャル</span>
        </div>
        <div className="flex items-center justify-between text-sm font-black">
          <span>所持金</span>
          <span className="tabular-nums">{cash.toLocaleString()} ニャル</span>
        </div>
        <div className="flex items-center justify-between text-sm font-black">
          <span>返済まで</span>
          <span className="tabular-nums">あと {repayIn} 日</span>
        </div>
      </div>
    ) : null;

  // ---- Intro (full modal) ---------------------------------------------------
  if (phase === 'intro') {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/85 p-4">
        {SkipButton}
        <div className="animate-pop w-full max-w-lg rounded-3xl border-4 border-amber-300 bg-[#fffdf7] px-8 py-8 text-center shadow-2xl">
          <div className="text-6xl">🍲🔥</div>
          <h2 className="mt-3 text-2xl font-black text-amber-900">火の消えかけたネコ村へようこそ</h2>
          <p className="mt-3 text-base font-bold leading-relaxed text-amber-800">
            あなたは借金を抱えた新しい村人ニャ。
            <br />
            まずは <span className="font-black text-rose-600">28日以内に1,000ニャルを返済</span> しよう。
            <br />
            少しずつ、村のことを覚えていこうニャ！
          </p>
          <div className="mt-4 rounded-xl bg-amber-100 px-3 py-1.5 text-sm font-black text-amber-700">
            👛 所持金 1,075ニャル ／ 🦝 借金 8,000ニャル
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'TUTORIAL_START' })}
            className="btn-press mt-6 rounded-2xl bg-amber-400 px-8 py-3 text-lg font-black text-amber-950 shadow-lg transition hover:bg-amber-300"
          >
            ▶ はじめる！
          </button>
        </div>
      </div>
    );
  }

  // ---- Completion (full modal) ----------------------------------------------
  if (phase === 'done') {
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
              <div className="rounded-xl bg-emerald-100 px-3 py-1.5">🏘️ 村レベル2を解放！</div>
              <div className="rounded-xl bg-emerald-100 px-3 py-1.5">⚙️ 金利レバーが使えるようになった</div>
              <div className="rounded-xl bg-emerald-100 px-3 py-1.5">📰 新聞・ダッシュボードが開いた</div>
            </div>
          ) : (
            <p className="mt-2 text-base font-bold leading-relaxed text-amber-800">
              たぬきち「今回は待つニャ。でも返済が遅れると負担が増えるニャ」
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

  // ---- Education popups (modal over the live map) ----------------------------
  if (popup === 'investEdu') {
    return (
      <>
        {StatusHud}
        {SkipButton}
        <EduPopup
          title="投資ってなに？"
          lesson="投資とは、事業にお金を出して、成長した利益の一部を受け取ることニャ。"
          onNext={() => setPopup(null)}
        />
      </>
    );
  }
  if (popup === 'roadEdu') {
    return (
      <>
        {StatusHud}
        {SkipButton}
        <EduPopup
          title="物流ってなに？"
          lesson="物流が良くなると、商品が早く届いて売上が増えるニャ。配当も増えたニャ！"
          onNext={() => setPopup(null)}
        />
      </>
    );
  }

  // ---- Conversation with ミケ (modal over the live map) ----------------------
  if (popup === 'talk') {
    return (
      <div className="fixed inset-0 z-[74] flex items-end justify-center bg-black/40 p-4 pb-24">
        {SkipButton}
        {StatusHud}
        <div className="w-full max-w-lg">
          <SpeechBubble avatar="🐱" speaker="ミケ">
            {TUTORIAL_INVEST_COST}ニャルあれば、小さなスープ屋を始められるニャ。
            成功したら毎日配当を払うニャ。
          </SpeechBubble>
          <div className="mt-4 flex flex-col items-center gap-2">
            <CtaButton
              onClick={() => {
                dispatch({ type: 'TUTORIAL_INVEST' });
                setPopup('investEdu');
              }}
            >
              🍲 {TUTORIAL_INVEST_COST}ニャル投資する
            </CtaButton>
            <button
              type="button"
              onClick={() => setPopup(null)}
              className="btn-press rounded-2xl border-2 border-amber-300 bg-white/90 px-6 py-2 text-base font-bold text-amber-700 transition hover:bg-amber-50"
            >
              まだやめる
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Live-map stages: HUD + a single bottom action (map stays visible) ----
  // Each stage surfaces exactly one primary button so the next move is obvious.
  let action: React.ReactNode = null;
  if (phase === 'invest') {
    action = <CtaButton onClick={() => setPopup('talk')}>🐱 ミケに話しかける</CtaButton>;
  } else if (phase === 'advance' || phase === 'repayWait') {
    action = (
      <CtaButton onClick={() => dispatch({ type: 'TUTORIAL_ADVANCE_DAY' })}>
        ☀️ 1日進める
      </CtaButton>
    );
  } else if (phase === 'roads') {
    action = (
      <CtaButton
        onClick={() => {
          dispatch({ type: 'TUTORIAL_LAY_ROADS' });
          setPopup('roadEdu');
        }}
      >
        🛤️ 石畳でつなぐ
      </CtaButton>
    );
  } else if (phase === 'repayment') {
    action = (
      <CtaButton onClick={() => dispatch({ type: 'TUTORIAL_REPAY' })}>
        💰 {TUTORIAL_REPAY_AMOUNT}ニャル返済する
      </CtaButton>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      {SkipButton}
      {StatusHud}

      {/* たぬきち turns up in person on repayment day */}
      {phase === 'repayment' && (
        <div className="pointer-events-auto absolute inset-x-0 top-1/3 mx-auto w-full max-w-lg px-4">
          <SpeechBubble avatar="🦝" speaker="たぬきち（返済日）" tone="sky">
            約束の返済日ニャ。{TUTORIAL_REPAY_AMOUNT}ニャル払うニャ。
          </SpeechBubble>
        </div>
      )}

      {/* The one action to take now, pinned bottom-centre with the day report */}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center">
        {dayReport}
        <div className="pointer-events-auto">{action}</div>
      </div>
    </div>
  );
}
