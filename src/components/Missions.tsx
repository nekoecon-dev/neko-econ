'use client';

import type { GameState } from '@/types/game';
import {
  MISSION_POPUP_TICKS,
  MISSION_REWARD,
  MISSIONS,
} from '@/lib/engine/missions';

export default function Missions({ state }: { state: GameState }) {
  const { index, lastRewardTick } = state.missions;
  const allDone = index >= MISSIONS.length;

  // The reward popup is purely derived from state: it shows for a few ticks
  // after each completion, then vanishes (no local timers needed).
  const showPopup =
    lastRewardTick >= 0 && state.tick - lastRewardTick < MISSION_POPUP_TICKS && index > 0;
  const justCleared = index > 0 ? MISSIONS[index - 1] : null;

  return (
    <>
      <div className="pointer-events-auto w-56 max-w-[60vw] rounded-3xl border-4 border-amber-200 bg-[#fffdf7]/95 p-3 shadow-md backdrop-blur">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-amber-900">
          <span className="text-lg">📋</span> 今日のミッション
        </h2>

        {allDone ? (
          <p className="rounded-xl bg-emerald-100 px-2.5 py-2 text-center text-xs font-bold text-emerald-700">
            🏆 全ミッション達成！立派な村長ニャ！
          </p>
        ) : (
          // Only ever the single current mission — completed/locked ones stay hidden.
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
            <div className="flex items-start gap-1.5 font-bold">
              <span>▶️</span>
              <span className="leading-snug">{MISSIONS[index].title}</span>
            </div>
            <div className="mt-0.5 pl-5 text-[10px] font-medium text-amber-600">
              💡 {MISSIONS[index].hint}（報酬 +{MISSION_REWARD}CC）
            </div>
          </div>
        )}
      </div>

      {/* reward popup, centred over the screen */}
      {showPopup && justCleared && (
        <div
          key={lastRewardTick}
          className="animate-pop pointer-events-none fixed left-1/2 top-1/3 z-50 -translate-x-1/2 rounded-3xl border-4 border-emerald-400 bg-white/95 px-6 py-4 text-center shadow-2xl"
        >
          <div className="text-2xl font-black text-emerald-600">🎉 ミッション達成！</div>
          <div className="mt-1 text-sm font-bold text-amber-800">{justCleared.title}</div>
          <div className="mt-1 text-lg font-black text-emerald-700">+{MISSION_REWARD} CC</div>
        </div>
      )}
    </>
  );
}
