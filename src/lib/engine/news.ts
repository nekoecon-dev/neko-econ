import type { Cat, Economy } from '@/types/game';

export const NEWS_MODEL = 'claude-haiku-4-5-20251001';
export const NEWS_MAX_TOKENS = 100;

export const NEWS_SYSTEM_PROMPT =
  '君は猫村の速報ニュースアナウンサーだ。経済の出来事を1文・40〜60字の日本語で、' +
  '少し大げさに、語尾は「ニャ」で読み上げる。具体的な数字を必ず1つ盛り込むこと。';

/** Build the user prompt fed to the model for a given event + economy snapshot. */
export function buildNewsPrompt(eventName: string, economy: Economy, cats: Cat[]): string {
  const richest = [...cats].sort((a, b) => b.money - a.money)[0];
  return [
    `【速報イベント】${eventName}`,
    `スープ価格: ${economy.soupPrice} CC`,
    `インフレ率: ${economy.inflationRate}%`,
    `失業率: ${economy.unemploymentRate}%`,
    `格差指数: ${economy.gini}`,
    `村の総通貨量: ${economy.totalMoney} CC`,
    richest ? `一番のお金持ち: ${richest.name}（${richest.money} CC）` : '',
    'この出来事をニュース速報として読み上げてニャ。',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Local templated headline used when no API key is available or the call fails. */
export function buildFallbackNews(eventName: string, economy: Economy): string {
  switch (eventName) {
    case 'ハイパーインフレ':
      return `速報ニャ！スープ価格が高騰、インフレ率${economy.inflationRate}%に達したニャ！`;
    case 'デフレ不況':
      return `大変ニャ…物価が下がり続けてインフレ率${economy.inflationRate}%、村は不況ニャ。`;
    case '食料危機':
      return `スープが1杯${economy.soupPrice}CCまで値上がり、食料危機が迫っているニャ！`;
    case '大量失業':
      return `働く猫が減って失業率${economy.unemploymentRate}%、村に失業の波ニャ…`;
    case '格差社会':
      return `格差指数が${economy.gini}に拡大、富める猫と貧しい猫の差が広がるニャ。`;
    case '好景気':
      return `好景気ニャ！インフレ率${economy.inflationRate}%で村の経済は絶好調ニャ！`;
    default:
      return `村で動きがあったニャ。スープ価格は${economy.soupPrice}CCニャ。`;
  }
}
