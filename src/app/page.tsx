'use client';

import { useGameLoop } from '@/hooks/useGameLoop';
import VillageMap from '@/components/VillageMap';
import EconomyDashboard from '@/components/EconomyDashboard';
import ControlPanel from '@/components/ControlPanel';
import NewsTicker from '@/components/NewsTicker';

export default function Home() {
  const { state, dispatch } = useGameLoop();

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 bg-green-50 p-4 text-gray-900">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">🐾 NekoEcon</h1>
        <span className="text-sm tabular-nums text-gray-500">tick: {state.tick}</span>
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
