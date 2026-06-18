import type { Cat, CatAction } from '@/types/game';

// Per-cat fur palette, keyed by id.
const FUR: Record<string, { coat: string; shade: string; ear: string }> = {
  '1': { coat: '#fbfcfe', shade: '#e2e8f0', ear: '#fbcfe8' }, // シロ (white)
  '2': { coat: '#6b7280', shade: '#4b5563', ear: '#fca5a5' }, // クロ (grey)
  '3': { coat: '#fb923c', shade: '#ea7c22', ear: '#fde0c2' }, // タマ (tabby)
  '4': { coat: '#fcd34d', shade: '#f1c232', ear: '#fde68a' }, // ミケ (cream)
  '5': { coat: '#f97316', shade: '#e2640c', ear: '#fed7aa' }, // チャトラ (orange)
};
const DEFAULT_FUR = { coat: '#fcd34d', shade: '#f1c232', ear: '#fde68a' };

const BUBBLE: Record<CatAction, string> = {
  idle: '🐾 ひま〜',
  working: '💰 はたらくニャ',
  eating: '🍲 いただきます',
  sleeping: '😴 Zzz…',
};

function Eyes({ action, bankrupt }: { action: CatAction; bankrupt: boolean }) {
  if (bankrupt) {
    // squeezed-shut crying eyes >_<
    return (
      <g stroke="#3f2d20" strokeWidth={2.4} fill="none" strokeLinecap="round">
        <path d="M26 36 q5 6 10 0" />
        <path d="M44 36 q5 6 10 0" />
      </g>
    );
  }
  if (action === 'sleeping') {
    return (
      <g stroke="#3f2d20" strokeWidth={2.2} fill="none" strokeLinecap="round">
        <path d="M26 38 q5 5 10 0" />
        <path d="M44 38 q5 5 10 0" />
      </g>
    );
  }
  if (action === 'eating') {
    // happy upward arcs ^ ^
    return (
      <g stroke="#3f2d20" strokeWidth={2.2} fill="none" strokeLinecap="round">
        <path d="M26 39 q5 -5 10 0" />
        <path d="M44 39 q5 -5 10 0" />
      </g>
    );
  }
  // open eyes with a highlight (idle / working)
  return (
    <g>
      <circle cx={31} cy={38} r={3.4} fill="#3f2d20" />
      <circle cx={49} cy={38} r={3.4} fill="#3f2d20" />
      <circle cx={32.2} cy={36.8} r={1.1} fill="#fff" />
      <circle cx={50.2} cy={36.8} r={1.1} fill="#fff" />
    </g>
  );
}

function CatIcon({ cat, bankrupt }: { cat: Cat; bankrupt: boolean }) {
  const fur = FUR[cat.id] ?? DEFAULT_FUR;
  return (
    <svg width={76} height={84} viewBox="0 0 80 88" className="drop-shadow-sm">
      {/* tail */}
      <path
        d="M60 64 q22 2 14 -20"
        fill="none"
        stroke={fur.shade}
        strokeWidth={7}
        strokeLinecap="round"
      />
      {/* body */}
      <ellipse cx={40} cy={66} rx={22} ry={17} fill={fur.coat} />
      <ellipse cx={40} cy={66} rx={22} ry={17} fill="none" stroke={fur.shade} strokeWidth={1.5} />
      {/* paws */}
      <ellipse cx={31} cy={80} rx={6} ry={4} fill={fur.coat} stroke={fur.shade} strokeWidth={1.2} />
      <ellipse cx={49} cy={80} rx={6} ry={4} fill={fur.coat} stroke={fur.shade} strokeWidth={1.2} />
      {/* ears */}
      <path d="M22 24 L17 4 L37 17 Z" fill={fur.coat} stroke={fur.shade} strokeWidth={1.5} />
      <path d="M58 24 L63 4 L43 17 Z" fill={fur.coat} stroke={fur.shade} strokeWidth={1.5} />
      <path d="M24 20 L22 9 L33 17 Z" fill={fur.ear} />
      <path d="M56 20 L58 9 L47 17 Z" fill={fur.ear} />
      {/* head */}
      <circle cx={40} cy={38} r={23} fill={fur.coat} stroke={fur.shade} strokeWidth={1.5} />
      {/* cheeks */}
      <circle cx={26} cy={46} r={4} fill="#fb7185" opacity={0.45} />
      <circle cx={54} cy={46} r={4} fill="#fb7185" opacity={0.45} />
      <Eyes action={cat.action} bankrupt={bankrupt} />
      {/* nose */}
      <path d="M40 44 l3 4 h-6 Z" fill="#fb7185" />
      {/* mouth */}
      <path
        d="M40 48 q-4 5 -8 2 M40 48 q4 5 8 2"
        fill="none"
        stroke="#3f2d20"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* whiskers */}
      <g stroke={fur.shade} strokeWidth={1.3} strokeLinecap="round">
        <path d="M16 44 h12" />
        <path d="M16 49 h12" />
        <path d="M64 44 h-12" />
        <path d="M64 49 h-12" />
      </g>
    </svg>
  );
}

export default function CatSprite({ cat }: { cat: Cat }) {
  const bankrupt = cat.money <= 0;
  const bubble = bankrupt ? '😭 もうだめニャ…' : BUBBLE[cat.action];
  const wrapperAnim = bankrupt ? 'cat-cry' : cat.action === 'sleeping' ? '' : 'cat-float';

  return (
    <div
      className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 select-none"
      style={{
        left: `${cat.x}%`,
        top: `${cat.y}%`,
        transition: 'left 0.4s ease, top 0.4s ease',
      }}
    >
      {/* state speech bubble */}
      <div className="relative mb-1">
        <div
          className={`whitespace-nowrap rounded-2xl border-2 px-2.5 py-1 text-[11px] font-bold shadow-sm ${
            bankrupt
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-amber-200 bg-white/95 text-amber-900'
          }`}
        >
          {bubble}
        </div>
        <div
          className={`absolute left-1/2 -bottom-1 h-2 w-2 -translate-x-1/2 rotate-45 border-b-2 border-r-2 ${
            bankrupt ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-white/95'
          }`}
        />
      </div>

      <div className="relative">
        <div className={wrapperAnim}>
          <CatIcon cat={cat} bankrupt={bankrupt} />
        </div>
        {bankrupt && (
          <>
            <span className="cat-tear absolute left-[26px] top-[40px] h-2.5 w-1.5 rounded-full bg-sky-400/90" />
            <span
              className="cat-tear absolute left-[46px] top-[40px] h-2.5 w-1.5 rounded-full bg-sky-400/90"
              style={{ animationDelay: '0.5s' }}
            />
          </>
        )}
      </div>

      <span className="-mt-1 rounded-full bg-amber-900/85 px-2 py-0.5 text-[11px] font-bold text-white shadow">
        {cat.name}
      </span>
      {/* real-time money badge */}
      <span
        className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold shadow ${
          bankrupt ? 'bg-red-600 text-white' : 'bg-white/90 text-amber-900'
        }`}
      >
        {Math.round(cat.money)} CC
      </span>
    </div>
  );
}
