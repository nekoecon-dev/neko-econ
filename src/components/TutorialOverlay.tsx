'use client';

import { useState } from 'react';
import type { GameState, PolicyAction } from '@/types/game';
import {
  DIVIDEND_AFTER_INVEST,
  DIVIDEND_AFTER_ROADS,
  TUTORIAL_INVEST_COST,
  TUTORIAL_RATE_STEP,
} from '@/lib/engine/tutorial';

// The overlay drives its own presentation steps; engine `phase` changes happen
// in lock-step via dispatch so the paused simulation + scripted economy stay in
// sync with what the player sees.
type View =
  | 'cinema' // chapter 0 opening cinematic
  | 'm1' // mission 1 — ミケ asks for investment
  | 'm1edu' // mission 1 — 投資 explanation
  | 'm2' // mission 2 — たぬきち asks for roads
  | 'm2edu' // mission 2 — 物流 explanation
  | 'm3' // mission 3 — たぬきち asks to raise the rate
  | 'm3edu' // mission 3 — 金利 explanation
  | 'complete'; // all done → free play

// ---- Chapter 0 cinematic: shown one card at a time, tap to advance ----------
type CinemaKind = 'narration' | 'mike' | 'tama' | 'call';
interface CinemaStep {
  kind: CinemaKind;
  emoji: string;
  text: string;
}
const CINEMA: CinemaStep[] = [
  { kind: 'narration', emoji: '🌑', text: 'ネコ村、危機的状況...' },
  { kind: 'narration', emoji: '🍲', text: 'スープ鍋の火が消えかけている😿' },
  { kind: 'narration', emoji: '🦝', text: 'たぬきちからの借金：残り18tickで1,000CC返済せよ' },
  { kind: 'mike', emoji: '🐱', text: 'スープ屋を始めたいけど資金がないニャ...' },
  { kind: 'tama', emoji: '🐈', text: '仕事がないニャ...お腹すいたニャ...' },
  { kind: 'call', emoji: '🎌', text: '村長よ、村を救ってくれ！' },
];

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
      <span className="text-5xl drop-shadow">{avatar}</span>
      <div className="min-w-0">
        <div className="text-xs font-black text-amber-600">{speaker}</div>
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
  const [view, setView] = useState<View>(
    state.tutorial.phase === 'opening' ? 'cinema' : 'complete',
  );
  const [cinemaStep, setCinemaStep] = useState(0);

  // The overlay only exists while the tutorial is running.
  if (!state.tutorial.active) return null;

  const skip = () => dispatch({ type: 'TUTORIAL_SKIP' });

  // Small skip button, top-right, present throughout the tutorial.
  const SkipButton = (
    <button
      type="button"
      onClick={skip}
      className="btn-press pointer-events-auto absolute right-3 top-3 z-[72] rounded-full border-2 border-white/70 bg-black/40 px-3 py-1 text-xs font-bold text-white/90 backdrop-blur transition hover:bg-black/60"
    >
      スキップ ▶▶
    </button>
  );

  // ---- Chapter 0: opening cinematic ----------------------------------------
  if (view === 'cinema') {
    const step = CINEMA[cinemaStep];
    const isLast = cinemaStep === CINEMA.length - 1;
    const advance = () => {
      if (isLast) {
        dispatch({ type: 'TUTORIAL_ADVANCE' });
        setView('m1');
      } else {
        setCinemaStep((s) => s + 1);
      }
    };
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/85 p-4">
        {SkipButton}
        <div key={cinemaStep} className="animate-pop w-full max-w-lg">
          {step.kind === 'mike' || step.kind === 'tama' ? (
            <SpeechBubble
              avatar={step.emoji}
              speaker={step.kind === 'mike' ? 'ミケ' : 'タマ'}
              tone={step.kind === 'mike' ? 'amber' : 'sky'}
            >
              {step.text}
            </SpeechBubble>
          ) : (
            <div className="rounded-3xl border-4 border-amber-300 bg-[#fffdf7] px-8 py-8 text-center shadow-2xl">
              <div className="text-6xl">{step.emoji}</div>
              <p className="mt-4 text-2xl font-black leading-relaxed text-amber-900">{step.text}</p>
            </div>
          )}
        </div>

        {/* progress dots */}
        <div className="mt-5 flex gap-2">
          {CINEMA.map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full transition ${
                i <= cinemaStep ? 'bg-amber-300' : 'bg-white/30'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={advance}
          className="btn-press mt-6 rounded-2xl bg-amber-400 px-8 py-3 text-lg font-black text-amber-950 shadow-lg transition hover:bg-amber-300"
        >
          {isLast ? '▶ はじめる！' : 'つぎへ ▶'}
        </button>
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
          lesson="投資とは、お金を出して事業の成長から利益を受け取ることニャ。"
          notes={[
            '🍲 ミケのスープ屋オープン！雇用が生まれた',
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
          lesson="物流とは、モノや人が速く動くほど経済は回りやすくなるということニャ。"
          notes={[
            '🛤️ 物流改善！スープの売上が上昇',
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
          lesson="金利とは、お金を借りた時に払う手数料ニャ。上げると貯金がお得になり、みんなお金を使わなくなる→物価が下がるニャ。"
          notes={[
            '😈 たぬきち「利息が上がったニャ。でも村は安定したニャ」',
            '📉 インフレ率が落ち着きました',
          ]}
          onNext={() => setView('complete')}
        />
      </>
    );
  }

  // ---- Completion ------------------------------------------------------------
  if (view === 'complete') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
        {SkipButton}
        <div className="animate-pop max-w-md rounded-3xl border-4 border-emerald-400 bg-[#fffdf7] p-7 text-center shadow-2xl">
          <div className="text-6xl">🎉</div>
          <h3 className="mt-3 text-2xl font-black text-emerald-700">チュートリアル完了！</h3>
          <p className="mt-2 text-base font-bold leading-relaxed text-amber-800">
            あとは自由に遊んでみようニャ🐾
            <br />
            村を豊かにして、借金も返していくニャ！
          </p>
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
  const missionPanel = (
    bubble: React.ReactNode,
    cta: React.ReactNode,
  ): React.ReactNode => (
    <div className="fixed inset-0 z-[70] bg-black/35">
      {SkipButton}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 flex flex-col items-center gap-4 px-4">
        <div className="pointer-events-auto w-full max-w-lg">{bubble}</div>
        <div className="pointer-events-auto">{cta}</div>
      </div>
    </div>
  );

  if (view === 'm1') {
    return missionPanel(
      <SpeechBubble avatar="🐱" speaker="ミケ">
        村長！{TUTORIAL_INVEST_COST}CCあれば小さなスープ屋を始められるニャ！
        うまくいったら毎tick配当を払うニャ！
      </SpeechBubble>,
      <CtaButton onClick={() => dispatch({ type: 'TUTORIAL_INVEST' })}>
        🍲 ミケに{TUTORIAL_INVEST_COST}CC投資する
      </CtaButton>,
    );
  }
  if (view === 'm2') {
    return missionPanel(
      <SpeechBubble avatar="🦝" speaker="たぬきち" tone="sky">
        スープ屋と鍋が遠くて配達が遅いニャ。
        道路を2マス敷けば猫の足が速くなるニャ！
      </SpeechBubble>,
      <CtaButton onClick={() => dispatch({ type: 'TUTORIAL_LAY_ROADS' })}>
        🛤️ 道路を2マス敷く
      </CtaButton>,
    );
  }
  if (view === 'm3') {
    return missionPanel(
      <SpeechBubble avatar="🦝" speaker="たぬきち" tone="sky">
        村長！お金が回り始めてスープの値段が上がってきたニャ。
        金利レバーを少し上げると物価が落ち着くニャ。
        でも…あなたの借金の利息も上がるニャ😈
      </SpeechBubble>,
      <CtaButton onClick={() => dispatch({ type: 'TUTORIAL_RAISE_RATE' })}>
        ⚙️ 金利を上げる（+{TUTORIAL_RATE_STEP}%）
      </CtaButton>,
    );
  }

  return null;
}
