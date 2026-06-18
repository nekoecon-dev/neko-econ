'use client';

import { useGameLoop } from '@/hooks/useGameLoop';
import VillageMap from '@/components/VillageMap';
import EconomyDashboard from '@/components/EconomyDashboard';
import ControlPanel from '@/components/ControlPanel';
import NewsTicker from '@/components/NewsTicker';

export default function Home() {
  const { state, dispatch } = useGameLoop();

  return (
    <main
      className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 text-amber-950"
      style={{
        background:
          'radial-gradient(1200px 500px at 50% -10%, #fff7e6 0%, #ffedcf 55%, #ffe3b3 100%)',
      }}
    >
      <header className="flex items-center justify-between rounded-3xl border-4 border-amber-200 bg-[#fffdf7] px-5 py-3 shadow-md">
        <h1 className="flex items-center gap-2 text-2xl font-black text-amber-900">
          <span className="text-3xl">🐾</span> NekoEcon
          <span className="hidden text-sm font-bold text-amber-700/70 sm:inline">
            猫の経済シミュレーション村
          </span>
        </h1>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold tabular-nums text-amber-800">
          🕒 tick {state.tick}
        </span>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <VillageMap cats={state.cats} />
        </section>
        <aside className="flex flex-col gap-4">
          <EconomyDashboard economy={state.economy} />
          <ControlPanel policy={state.policy} dispatch={dispatch} />
        </aside>
      </div>

      <footer>
        <NewsTicker news={state.newsLog} />
      </footer>
    </main>
  );
}
