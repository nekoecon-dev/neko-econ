import type { Cat } from '@/types/game';
import CatSprite from './CatSprite';

export default function VillageMap({ cats }: { cats: Cat[] }) {
  return (
    <div className="relative h-full min-h-[360px] w-full overflow-hidden rounded-xl border border-green-300 bg-green-100">
      {/* simple scenery */}
      <div className="pointer-events-none absolute left-4 top-4 text-3xl">🌳</div>
      <div className="pointer-events-none absolute right-6 top-10 text-3xl">🌲</div>
      <div className="pointer-events-none absolute bottom-6 left-10 text-3xl">🏠</div>
      <div className="pointer-events-none absolute bottom-8 right-8 text-3xl">🌻</div>
      {cats.map((cat) => (
        <CatSprite key={cat.id} cat={cat} />
      ))}
    </div>
  );
}
