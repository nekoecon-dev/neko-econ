'use client';

import { useGameLoop } from '@/hooks/useGameLoop';
import Village3D from '@/components/Village3D';
import InflationPanel from '@/components/InflationPanel';
import StockMarket from '@/components/StockMarket';
import StrikeBanner from '@/components/StrikeBanner';
import PlayerHouse from '@/components/PlayerHouse';
import PublicWorks from '@/components/PublicWorks';
import NewsTicker from '@/components/NewsTicker';
import OpeningMessage from '@/components/OpeningMessage';
import Missions from '@/components/Missions';

export default function Home() {
  const { state, dispatch } = useGameLoop();

  return (
    <main className="relative h-screen w-screen overflow-hidden text-amber-950">
      <OpeningMessage />

      {/* 3D village fills the whole screen as the background */}
      <div className="absolute inset-0">
        <Village3D state={state} dispatch={dispatch} />
      </div>

      {/* top bar: title + tick + wallet (non-interactive, floats over the canvas) */}
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

      {/* right-hand overlay: only the small inflation graph + stock / works panels
          (the economic dashboard now lives in the 3D world). */}
      <aside className="pointer-events-none absolute right-0 top-16 bottom-20 flex w-[88%] max-w-xs flex-col gap-3 overflow-y-auto p-3 [&>*]:pointer-events-auto">
        <InflationPanel economy={state.economy} />
        <StockMarket
          cats={state.cats}
          stocks={state.stocks}
          player={state.player}
          dispatch={dispatch}
        />
        <PublicWorks facilities={state.facilities} cash={state.player.cash} />
      </aside>

      {/* mission panel + reward popup, left side under the title */}
      <div className="pointer-events-none absolute left-3 top-16">
        <Missions state={state} />
      </div>

      {/* strike banner, centred */}
      {state.strike.active && (
        <StrikeBanner reliefCount={state.strike.reliefCount} taxRate={state.policy.taxRate} />
      )}

      {/* player house / loan, bottom-left over the canvas */}
      <PlayerHouse
        player={state.player}
        interestRate={state.policy.interestRate}
        dispatch={dispatch}
        className="bottom-24 left-3"
      />

      {/* news ticker pinned to the bottom */}
      <footer className="absolute inset-x-0 bottom-0 p-3">
        <NewsTicker news={state.newsLog} />
      </footer>
    </main>
  );
}
