export default function StrikeBanner({
  reliefCount,
  taxRate,
}: {
  reliefCount: number;
  taxRate: number;
}) {
  const reliefLeft = Math.max(0, 3 - reliefCount);
  const taxOk = taxRate >= 30;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 z-30 flex justify-center px-4">
      <div className="animate-pulse rounded-2xl border-4 border-red-800 bg-red-600/95 px-6 py-3 text-center text-white shadow-2xl">
        <div className="text-xl font-black tracking-wide">✊ ストライキ発生！ 🪧</div>
        <div className="mt-1 text-xs font-bold">猫たちが労働を拒否中ニャ！</div>
        <div className="mt-1 text-[11px] leading-relaxed">
          解除条件：税率を30%以上に（現在 {taxRate}% {taxOk ? '✅' : '❌'}）
          <br />
          または +100ニャル配布 あと {reliefLeft} 回
        </div>
      </div>
    </div>
  );
}
