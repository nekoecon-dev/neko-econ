'use client';

import { useEffect, useState } from 'react';

// The opening cinematic: each line shows for ~2s, then advances. Skippable.
const STEPS = [
  { text: 'ここは猫たちが暮らす小さな村...', emoji: '🏘️' },
  { text: 'あなたはこの村の村長です', emoji: '🎩' },
  { text: 'シロ銀行から10,000CCの借金を背負ってスタート！', emoji: '🏦' },
  { text: '猫たちと一緒に、豊かな村を作ろう！', emoji: '🐱' },
  { text: 'でも気をつけて...インフレと恐慌があなたを狙っている😈', emoji: '⚠️' },
];
const STEP_MS = 2000;

export default function OpeningMessage() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  // Advance one step every STEP_MS; close after the last line. setState only
  // runs inside the (asynchronous) timeout callback, never synchronously.
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => {
      if (step + 1 >= STEPS.length) setVisible(false);
      else setStep(step + 1);
    }, STEP_MS);
    return () => clearTimeout(id);
  }, [step, visible]);

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/70 p-4">
      {/* re-keyed per step so it re-plays the pop animation each line */}
      <div
        key={step}
        className="animate-pop max-w-lg rounded-3xl border-4 border-amber-300 bg-[#fffdf7] px-8 py-7 text-center shadow-2xl"
      >
        <div className="text-5xl">{current.emoji}</div>
        <p className="mt-4 text-lg font-black leading-relaxed text-amber-900">{current.text}</p>
      </div>

      {/* progress dots */}
      <div className="mt-5 flex gap-2">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full transition ${
              i <= step ? 'bg-amber-300' : 'bg-white/30'
            }`}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setVisible(false)}
        className="btn-press mt-6 rounded-2xl bg-amber-200/90 px-6 py-2 text-sm font-bold text-amber-900 shadow-lg transition hover:bg-amber-300"
      >
        スキップ ▶▶
      </button>
    </div>
  );
}
