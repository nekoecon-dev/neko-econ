'use client';

import { useState } from 'react';
import type { FacilityKind } from '@/types/game';
import { FACILITY_META } from '@/lib/engine/facilities';
import { useGameLoop } from '@/hooks/useGameLoop';
import Village3D from '@/components/Village3D';
import InflationPanel from '@/components/InflationPanel';
import StockMarket from '@/components/StockMarket';
import StrikeBanner from '@/components/StrikeBanner';
import LoanModal from '@/components/LoanModal';
import PublicWorks from '@/components/PublicWorks';
import NewsTicker from '@/components/NewsTicker';
import TutorialOverlay from '@/components/TutorialOverlay';
import LifeOverlay, { type LifeTalking } from '@/components/LifeOverlay';
import Missions from '@/components/Missions';
import RepaymentTimer from '@/components/RepaymentTimer';
import GameOverScreen from '@/components/GameOverScreen';

export default function Home() {
  const { state, dispatch, reset } = useGameLoop();
  const [loanOpen, setLoanOpen] = useState(false);
  const [pending, setPending] = useState<FacilityKind | null>(null);
  const [roadMode, setRoadMode] = useState(false);
  const [talking, setTalking] = useState<LifeTalking>(null);
  const repayRemaining = Math.max(0, state.repayDueTick - state.tick);
  const lifeMode = state.life.active;

  return (
    <main className="relative h-screen w-screen overflow-hidden text-amber-950">
      {/* 3D village fills the whole screen as the background (handles both modes) */}
      <div className="absolute inset-0">
        <Village3D
          state={state}
          dispatch={dispatch}
          onOpenLoan={() => setLoanOpen(true)}
          pendingFacility={pending}
          onPlaced={() => setPending(null)}
          roadMode={roadMode}
          onTalkMike={() => setTalking('mike')}
          onTalkTanuki={() => setTalking('tanuki')}
        />
      </div>

      {/* ---- Life mode: the cosy "living in the village" prototype ---- */}
      {lifeMode && (
        <LifeOverlay state={state} dispatch={dispatch} talking={talking} setTalking={setTalking} />
      )}

      {/* ---- Economy mode: the full dashboard / tutorial UI ---- */}
      {!lifeMode && (
        <>
          <TutorialOverlay state={state} dispatch={dispatch} />

          {/* placement-mode banner */}
          {pending && (
            <div className="pointer-events-none absolute left-1/2 top-20 z-40 -translate-x-1/2">
              <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border-2 border-sky-300 bg-[#fffdf7]/95 px-4 py-2 text-sm font-bold text-sky-800 shadow-lg backdrop-blur">
                <span>
                  {FACILITY_META[pending].icon} {FACILITY_META[pending].name}を設置中… マップをクリック！
                </span>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="btn-press rounded-xl bg-rose-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-600"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {/* top bar: title + tick + wallet */}
          <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 p-3">
            <h1 className="flex items-center gap-2 rounded-2xl border-2 border-amber-200 bg-[#fffdf7]/90 px-4 py-2 text-xl font-black text-amber-900 shadow-md backdrop-blur">
              <span className="text-2xl">🐾</span> NekoEcon
              <span className="hidden text-xs font-bold text-amber-700/70 sm:inline">3D村</span>
            </h1>
            <div className="flex items-center gap-2">
              <span className="rounded-full border-2 border-amber-200 bg-[#fffdf7]/90 px-3 py-1.5 text-sm font-bold tabular-nums text-amber-800 shadow-md backdrop-blur">
                🕒 {state.tick}
              </span>
              <div className="flex items-center gap-2 rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-yellow-100/95 to-amber-100/95 px-3 py-1.5 shadow-md backdrop-blur">
                <span className="text-xl">👛</span>
                <div className="leading-tight">
                  <div className="text-[9px] font-bold text-amber-700/70">所持金</div>
                  <div className="text-lg font-black tabular-nums text-amber-900">
                    {Math.round(state.player.cash).toLocaleString()} CC
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* right-hand overlay: inflation graph + stock / works panels (stocks
              unlock at village level 3) */}
          {!state.tutorial.active && (
            <aside className="pointer-events-none absolute right-0 top-16 bottom-20 flex w-[88%] max-w-xs flex-col gap-3 overflow-y-auto p-3 [&>*]:pointer-events-auto">
              <InflationPanel economy={state.economy} />
              {state.villageLevel >= 3 && (
                <StockMarket
                  cats={state.cats}
                  stocks={state.stocks}
                  player={state.player}
                  dispatch={dispatch}
                />
              )}
              <PublicWorks
                facilities={state.facilities}
                cash={state.player.cash}
                pending={pending}
                onPick={(kind) => {
                  setPending(kind);
                  setRoadMode(false);
                }}
              />
            </aside>
          )}

          {/* forced-repayment countdown, top centre */}
          {!state.tutorial.active && (
            <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2">
              <RepaymentTimer remaining={repayRemaining} />
            </div>
          )}

          {/* free-play mission panel */}
          {!state.tutorial.active && (
            <div className="pointer-events-none absolute left-3 top-28">
              <Missions state={state} />
            </div>
          )}

          {/* road-laying button (bottom-left) */}
          {!state.tutorial.active && (
            <div className="absolute bottom-20 left-3 z-30 flex flex-col items-start gap-1">
              {roadMode && (
                <div className="pointer-events-none rounded-xl border-2 border-amber-700 bg-[#fffdf7]/95 px-3 py-1.5 text-[11px] font-bold text-amber-800 shadow">
                  🖱️ マップをクリック＆ドラッグして道路を敷くニャ（10CC/マス・道路が多いほどGDP↑）
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setRoadMode((m) => !m);
                  setPending(null);
                }}
                className={`btn-press rounded-2xl border-2 px-4 py-2 text-sm font-extrabold shadow-md backdrop-blur transition ${
                  roadMode
                    ? 'border-amber-700 bg-amber-500 text-white'
                    : 'border-amber-300 bg-[#fffdf7]/90 text-amber-900 hover:bg-amber-100'
                }`}
              >
                🛤️ 道路を敷く（10CC/マス）{roadMode ? '（ON）' : ''}
              </button>
            </div>
          )}

          {/* strike banner, centred */}
          {state.strike.active && (
            <StrikeBanner reliefCount={state.strike.reliefCount} taxRate={state.policy.taxRate} />
          )}

          {/* loan repayment popup, opened by clicking the たぬきち banker in 3D */}
          <LoanModal
            player={state.player}
            interestRate={state.policy.interestRate}
            dispatch={dispatch}
            open={loanOpen}
            onClose={() => setLoanOpen(false)}
          />

          {/* news ticker pinned to the bottom — unlocked after the tutorial */}
          {!state.tutorial.active && (
            <footer className="absolute inset-x-0 bottom-0 p-3">
              <NewsTicker news={state.newsLog} />
            </footer>
          )}

          {/* foreclosure / game over */}
          {state.gameOver && <GameOverScreen onRetry={reset} />}
        </>
      )}
    </main>
  );
}
