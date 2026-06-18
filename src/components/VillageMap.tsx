import type { Cat, Economy, FacilityKind, FacilityState, StockShare, Weather } from '@/types/game';
import { FACILITY_META } from '@/lib/engine/facilities';
import CatSprite from './CatSprite';

// Where each built facility appears on the map.
const FACILITY_POS: Record<FacilityKind, string> = {
  soupFactory: 'left-[9%] top-[46%]',
  matatabiPark: 'right-[26%] top-[58%]',
  fishingPond: 'left-[15%] bottom-[19%]',
};
const FACILITY_KINDS: FacilityKind[] = ['soupFactory', 'matatabiPark', 'fishingPond'];

// A wooden signboard overlaid on the village showing a live economic figure.
function SignBoard({
  className,
  icon,
  title,
  value,
}: {
  className: string;
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute z-20 rounded-xl border-2 border-amber-800 bg-amber-50/95 px-2.5 py-1.5 text-center shadow-lg ${className}`}
    >
      <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-800">
        <span>{icon}</span>
        {title}
      </div>
      <div className="text-sm font-black tabular-nums text-amber-900">{value}</div>
    </div>
  );
}

// "Neko Wall Street" LED ticker: every cat's price with ▲/▼ + the latest news.
function WallStreetTicker({
  entries,
  news,
  className,
}: {
  entries: { name: string; price: number; up: boolean }[];
  news: string;
  className: string;
}) {
  const content = (
    <span className="px-3">
      {entries.map((e, i) => (
        <span key={i} className="mr-3">
          <span className="text-cyan-200">{e.name}</span>{' '}
          <span className={e.up ? 'text-green-400' : 'text-red-400'}>
            {Math.round(e.price)}CC {e.up ? '▲' : '▼'}
          </span>
        </span>
      ))}
      <span className="text-yellow-300">📰 {news}</span>
      <span className="px-2 text-gray-600">●</span>
    </span>
  );

  return (
    <div
      className={`pointer-events-none absolute z-20 flex w-64 items-stretch overflow-hidden rounded-lg border-2 border-gray-700 bg-gray-900/95 shadow-lg ${className}`}
    >
      <div className="flex items-center border-r border-gray-700 bg-gray-800 px-2 text-[10px] font-bold text-cyan-300">
        🏢 ウォール街
      </div>
      <div className="relative flex-1 overflow-hidden py-1">
        <div className="news-marquee whitespace-nowrap font-mono text-xs font-bold">
          {content}
          {content}
        </div>
      </div>
    </div>
  );
}

// Background gradient per weather state.
const BG: Record<Weather, string> = {
  normal:
    'linear-gradient(to bottom, #cdeefe 0%, #d7f1ff 20%, #bdeca0 20%, #93d96f 70%, #7cc95a 100%)',
  boom: 'linear-gradient(to bottom, #fff7cc 0%, #ffe9a3 22%, #ffd86b 22%, #f4c430 70%, #e6b422 100%)',
  hyperinflation:
    'linear-gradient(to bottom, #7f1d1d 0%, #b91c1c 28%, #ea580c 60%, #f59e0b 100%)',
  depression:
    'linear-gradient(to bottom, #94a3b8 0%, #64748b 30%, #475569 70%, #334155 100%)',
};

// Deterministic layouts (no Math.random — keeps SSR/CSR hydration stable).
const BILLS = Array.from({ length: 12 }, (_, i) => ({
  left: (i * 8 + 5) % 95,
  delay: (i % 5) * 0.7,
  dur: 5 + (i % 4),
  emoji: i % 3 === 0 ? '💴' : i % 3 === 1 ? '💵' : '💰',
}));
const DROPS = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 4 + 2) % 99,
  delay: (i % 7) * 0.22,
  dur: 0.8 + (i % 3) * 0.2,
}));

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {BILLS.map((b, i) => (
        <span
          key={i}
          className="confetti-bill text-2xl"
          style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }}
        >
          {b.emoji}
        </span>
      ))}
    </div>
  );
}

function Rain() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {DROPS.map((d, i) => (
        <span
          key={i}
          className="rain-drop"
          style={{ left: `${d.left}%`, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }}
        />
      ))}
    </div>
  );
}

export default function VillageMap({
  cats,
  economy,
  stocks,
  facilities,
  latestNews = '村は今日も平和ニャ',
  weather = 'normal',
  strikeActive = false,
}: {
  cats: Cat[];
  economy: Economy;
  stocks: Record<string, StockShare>;
  facilities: FacilityState;
  latestNews?: string;
  weather?: Weather;
  strikeActive?: boolean;
}) {
  const depression = weather === 'depression';
  const hyper = weather === 'hyperinflation';
  const boom = weather === 'boom';

  // Ticker entries: each cat's price with up/down direction vs the prev tick.
  const tickerEntries = cats.map((c) => {
    const s = stocks[c.id];
    return { name: c.name, price: s?.price ?? 0, up: (s?.price ?? 0) >= (s?.prevPrice ?? 0) };
  });

  const sunClass = hyper
    ? 'right-1/2 top-2 h-44 w-44 translate-x-1/2 animate-pulse bg-orange-400 shadow-[0_0_90px_40px_rgba(249,115,22,0.85)]'
    : boom
      ? 'right-8 top-6 h-20 w-20 bg-amber-300 shadow-[0_0_60px_22px_rgba(251,191,36,0.75)]'
      : 'right-8 top-6 h-16 w-16 bg-yellow-300 shadow-[0_0_40px_12px_rgba(253,224,71,0.6)]';

  return (
    <div
      className="relative h-full min-h-[480px] w-full overflow-hidden rounded-3xl border-4 border-amber-200 shadow-inner transition-[filter] duration-700"
      style={{
        background: BG[weather],
        filter: depression ? 'grayscale(1) brightness(0.7)' : 'none',
      }}
    >
      {/* sun (hidden under the rain clouds during a depression) */}
      {!depression && (
        <div className={`pointer-events-none absolute rounded-full transition-all duration-700 ${sunClass}`} />
      )}

      {/* clouds (cleared away by the hyperinflation heat) */}
      {!hyper && (
        <>
          <div className="pointer-events-none absolute left-10 top-8 h-6 w-20 rounded-full bg-white/90 blur-[1px]" />
          <div className="pointer-events-none absolute left-20 top-12 h-5 w-14 rounded-full bg-white/80 blur-[1px]" />
          <div className="pointer-events-none absolute left-1/2 top-6 h-5 w-16 rounded-full bg-white/80 blur-[1px]" />
        </>
      )}

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

      {/* public-works facilities */}
      {FACILITY_KINDS.map((kind) =>
        facilities[kind] > 0 ? (
          <div
            key={kind}
            className={`pointer-events-none absolute z-10 flex flex-col items-center ${FACILITY_POS[kind]}`}
          >
            <span className="text-4xl drop-shadow">{FACILITY_META[kind].icon}</span>
            {facilities[kind] > 1 && (
              <span className="rounded-full bg-amber-900/85 px-1.5 text-[9px] font-bold text-white">
                ×{facilities[kind]}
              </span>
            )}
          </div>
        ) : null,
      )}

      {/* cats */}
      {cats.map((cat) => (
        <CatSprite key={cat.id} cat={cat} weather={weather} onStrike={strikeActive} />
      ))}

      {/* in-map economic signboards */}
      <SignBoard
        className="left-3 top-3"
        icon="🏦"
        title="ネコ銀行"
        value={`${Math.round(economy.totalMoney)} CC`}
      />
      <SignBoard
        className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        icon="🍲"
        title="スープ鍋"
        value={`${economy.soupPrice} CC`}
      />
      <WallStreetTicker className="bottom-3 right-3" entries={tickerEntries} news={latestNews} />

      {/* weather effects */}
      {boom && <Confetti />}
      {depression && <Rain />}
    </div>
  );
}
