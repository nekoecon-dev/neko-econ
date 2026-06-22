'use client';

import { REPAY_WARN_TICKS } from '@/lib/engine/loanDeadline';

/** Big always-on countdown to the next forced loan repayment. */
export default function RepaymentTimer({ remaining }: { remaining: number }) {
  const warn = remaining <= REPAY_WARN_TICKS;
  return (
    <div
      className={`pointer-events-none rounded-2xl border-2 px-4 py-1.5 text-center shadow-md backdrop-blur ${
        warn ? 'countdown-blink border-red-400 bg-red-50/95' : 'border-amber-200 bg-[#fffdf7]/90'
      }`}
    >
      <div className="text-[10px] font-bold text-amber-700/70">⏰ 次の返済まで</div>
      <div
        className={`text-2xl font-black tabular-nums ${warn ? 'text-red-600' : 'text-amber-900'}`}
      >
        あと {remaining} 日
      </div>
    </div>
  );
}
