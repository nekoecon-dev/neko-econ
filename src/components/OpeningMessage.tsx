'use client';

import { useEffect, useState } from 'react';

/**
 * Welcome banner shown once at game start: the player begins 10,000 CC in debt
 * to シロ銀行. Auto-dismisses after 3 seconds (and on click).
 */
export default function OpeningMessage() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={() => setVisible(false)}
      role="presentation"
    >
      <div className="animate-pop max-w-md rounded-3xl border-4 border-amber-300 bg-[#fffdf7] px-7 py-6 text-center shadow-2xl">
        <div className="text-4xl">⛺🏦</div>
        <h2 className="mt-3 text-xl font-black text-amber-900">ようこそ、NekoEconへ！</h2>
        <p className="mt-2 text-sm font-bold text-amber-800">
          シロ銀行からの借金 <span className="text-red-600">10,000 CC</span> を背負ってスタートです。
        </p>
        <p className="mt-1 text-xs text-amber-700/80">
          村の経済を育てて、コツコツ返済していくニャ！
        </p>
      </div>
    </div>
  );
}
