import type { Cat } from '@/types/game';
import CatSprite from './CatSprite';

export type VillageMood = 'boom' | 'normal' | 'recession';

// Tint overlay laid over the map to reflect the economic mood.
const MOOD_OVERLAY: Record<VillageMood, string> = {
  boom: 'bg-amber-200/25',
  normal: 'bg-transparent',
  recession: 'bg-slate-800/30',
};

export default function VillageMap({
  cats,
  mood = 'normal',
}: {
  cats: Cat[];
  mood?: VillageMood;
}) {
  return (
    <div
      className="relative h-full min-h-[480px] w-full overflow-hidden rounded-3xl border-4 border-amber-200 shadow-inner"
      style={{
        background:
          'linear-gradient(to bottom, #cdeefe 0%, #d7f1ff 20%, #bdeca0 20%, #93d96f 70%, #7cc95a 100%)',
      }}
    >
      {/* sun */}
      <div className="pointer-events-none absolute right-8 top-6 h-16 w-16 rounded-full bg-yellow-300 shadow-[0_0_40px_12px_rgba(253,224,71,0.6)]" />
      {/* clouds */}
      <div className="pointer-events-none absolute left-10 top-8 h-6 w-20 rounded-full bg-white/90 blur-[1px]" />
      <div className="pointer-events-none absolute left-20 top-12 h-5 w-14 rounded-full bg-white/80 blur-[1px]" />
      <div className="pointer-events-none absolute left-1/2 top-6 h-5 w-16 rounded-full bg-white/80 blur-[1px]" />

      {/* pond */}
      <div className="pointer-events-none absolute bottom-6 left-6 h-16 w-28 rounded-[50%] bg-sky-300/80 shadow-inner ring-2 ring-sky-200/70" />

      {/* path */}
      <div className="pointer-events-none absolute -bottom-4 right-16 h-40 w-16 rotate-12 rounded-full bg-amber-100/70" />

      {/* scenery */}
      <div className="pointer-events-none absolute left-4 top-[26%] text-6xl drop-shadow">🌳</div>
      <div className="pointer-events-none absolute right-6 top-[40%] text-5xl drop-shadow">🌲</div>
      <div className="pointer-events-none absolute right-1/3 top-[24%] text-5xl drop-shadow">🏡</div>
      <div className="pointer-events-none absolute left-1/3 bottom-4 text-5xl drop-shadow">🏠</div>
      <div className="pointer-events-none absolute right-10 bottom-6 text-4xl">🌻</div>
      <div className="pointer-events-none absolute left-1/2 bottom-10 text-3xl">🌷</div>
      <div className="pointer-events-none absolute right-1/4 bottom-12 text-3xl">🌼</div>
      <div className="pointer-events-none absolute left-24 top-[55%] text-2xl">🍄</div>

      {/* cats */}
      {cats.map((cat) => (
        <CatSprite key={cat.id} cat={cat} />
      ))}

      {/* mood tint */}
      <div
        className={`pointer-events-none absolute inset-0 transition-colors duration-700 ${MOOD_OVERLAY[mood]}`}
      />
    </div>
  );
}
