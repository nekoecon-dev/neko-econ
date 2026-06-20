'use client';

/** Full-screen foreclosure / game-over overlay with a retry button. */
export default function GameOverScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/85 p-6 text-center">
      <div className="animate-pop text-2xl font-black text-red-300 sm:text-4xl">
        😱 たぬきちに家を差し押さえられた…
      </div>
      <div className="mt-8 text-6xl font-black tracking-widest text-white sm:text-8xl">
        GAME OVER
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="btn-press mt-10 rounded-2xl bg-amber-500 px-8 py-3 text-lg font-extrabold text-white shadow-lg transition hover:bg-amber-600"
      >
        🔄 リトライする
      </button>
    </div>
  );
}
