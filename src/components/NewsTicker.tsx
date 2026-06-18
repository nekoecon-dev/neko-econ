import type { NewsItem } from '@/types/game';

export default function NewsTicker({ news }: { news: NewsItem[] }) {
  const latest = news.slice(0, 3);
  const text =
    latest.length > 0
      ? latest.map((n) => `【${n.event}】${n.text}`).join('　／　')
      : '🐾 NekoEcon 村は今日も平和ニャ。政策を動かして経済を観察してニャ。';

  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900 py-2 text-yellow-300">
      <div className="news-marquee whitespace-nowrap text-sm font-medium">
        <span className="px-4">📰 {text}</span>
        <span className="px-4">📰 {text}</span>
      </div>
    </div>
  );
}
