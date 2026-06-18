import type { NewsItem } from '@/types/game';

export default function NewsTicker({ news }: { news: NewsItem[] }) {
  const latest = news.slice(0, 3);
  const text =
    latest.length > 0
      ? latest.map((n) => `【${n.event}】${n.text}`).join('　　◆　　')
      : '本日の村は平和ニャ。政策を動かして経済の動きを見守るニャ。';

  return (
    <div className="overflow-hidden rounded-2xl border-4 border-amber-900 bg-[#f7f1e1] shadow-md">
      <div className="flex items-stretch">
        {/* newspaper nameplate */}
        <div className="flex shrink-0 items-center gap-1.5 border-r-4 border-double border-amber-900 bg-amber-900 px-3 py-2 text-amber-50">
          <span className="text-lg">📰</span>
          <span className="font-serif text-sm font-black tracking-tight">
            にゃんこ新聞
          </span>
        </div>
        {/* scrolling ticker */}
        <div className="relative flex-1 overflow-hidden py-2">
          <div className="news-marquee whitespace-nowrap font-serif text-sm font-bold text-amber-950">
            <span className="px-6">{text}</span>
            <span className="px-6">{text}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
