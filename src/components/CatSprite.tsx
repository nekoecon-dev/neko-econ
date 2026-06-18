import type { Cat, CatAction } from '@/types/game';

const ACTION_EMOJI: Record<CatAction, string> = {
  idle: '🐱',
  sleeping: '😴',
  eating: '🍲',
  working: '💰',
};

export default function CatSprite({ cat }: { cat: Cat }) {
  return (
    <div
      className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 select-none"
      style={{
        left: `${cat.x}%`,
        top: `${cat.y}%`,
        transition: 'left 0.4s ease, top 0.4s ease',
      }}
    >
      <span className="text-4xl leading-none drop-shadow-sm">
        {ACTION_EMOJI[cat.action]}
      </span>
      <span className="mt-0.5 rounded bg-white/80 px-1 text-[10px] font-medium text-gray-800">
        {cat.name}
      </span>
    </div>
  );
}
