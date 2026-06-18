'use client';

import { useGameLoop } from '@/hooks/useGameLoop';
import VillageMap from '@/components/VillageMap';
import EconomyDashboard from '@/components/EconomyDashboard';
import ControlPanel from '@/components/ControlPanel';
import StockMarket from '@/components/StockMarket';
import StrikeBanner from '@/components/StrikeBanner';
import PlayerHouse from '@/components/PlayerHouse';
import PublicWorks from '@/components/PublicWorks';
import NewsTicker from '@/components/NewsTicker';

export default function Home() {
  const { state, dispatch } = useGameLoop();
  const weather = state.weather.current;

  return (
    <main
      className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 text-amber-950"
      style={{
        background:
          'radial-gradient(1200px 500px at 50% -10%, #fff7e6 0%, #ffedcf 55%, #ffe3b3 100%)',
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border-4 border-amber-200 bg-[#fffdf7] px-5 py-3 shadow-md">
        <h1 className="flex items-center gap-2 text-2xl font-black text-amber-900">
          <span className="text-3xl">🐾</span> NekoEcon
          <span className="hidden text-sm font-bold text-amber-700/70 sm:inline">
            猫の経済シミュレーション村
          </span>
        </h1>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold tabular-nums text-amber-800">
            🕒 tick {state.tick}
          </span>
          <div className="flex items-center gap-2 rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-yellow-100 to-amber-100 px-4 py-1.5 shadow-sm">
            <span className="text-2xl">👛</span>
            <div className="leading-tight">
              <div className="text-[10px] font-bold text-amber-700/70">あなたの所持金</div>
              <div className="text-2xl font-black tabular-nums text-amber-900">
                {Math.round(state.player.cash).toLocaleString()} CC
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="relative lg:col-span-2">
          <VillageMap
            cats={state.cats}
            economy={state.economy}
            stocks={state.stocks}
            facilities={state.facilities}
            latestNews={state.newsLog[0]?.text}
            weather={weather}
            strikeActive={state.strike.active}
          />
          {state.strike.active && (
            <StrikeBanner reliefCount={state.strike.reliefCount} taxRate={state.policy.taxRate} />
          )}
          <PlayerHouse
            player={state.player}
            interestRate={state.policy.interestRate}
            dispatch={dispatch}
            className="bottom-2 left-2"
          />
        </section>
        <aside className="flex flex-col gap-4">
          <EconomyDashboard economy={state.economy} />
          <StockMarket
            cats={state.cats}
            stocks={state.stocks}
            player={state.player}
            dispatch={dispatch}
          />
          <ControlPanel policy={state.policy} dispatch={dispatch} />
          <PublicWorks
            facilities={state.facilities}
            cash={state.player.cash}
            dispatch={dispatch}
          />
        </aside>
      </div>

      <footer>
        <NewsTicker news={state.newsLog} />
      </footer>
    </main>
  );
}
