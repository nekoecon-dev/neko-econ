import { test, expect } from '@playwright/test';
import type { GameState } from '../src/types/game';

// The game loop exposes its live state on window.__neko for these tests.
declare global {
  interface Window {
    __neko?: GameState;
  }
}

const neko = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__neko) as Promise<GameState>;

/**
 * Walk the stage-gated onboarding from the opening card to free play, asserting
 * the spec's checklist: a minimal first screen, an obvious first action (talk to
 * ミケ), dividends after investing, a bigger dividend after the 石畳, a clean run
 * to the repayment day, and that stocks / news / the 税率 lever stay hidden the
 * whole way through.
 */
test('stage tutorial runs start to finish without breaking', async ({ page }) => {
  // `/` now boots life mode; the guided economy tutorial lives behind ?mode.
  await page.goto('/?mode=tutorial');
  await page.waitForFunction(() => window.__neko !== undefined, undefined, { timeout: 30_000 });

  // --- Boot: paused at the intro with the stage-1 numbers ---
  const boot = await neko(page);
  expect(boot.tutorial.active).toBe(true);
  expect(boot.tutorial.phase).toBe('intro');
  expect(Math.round(boot.player.cash)).toBe(1075);
  expect(Math.round(boot.player.loan)).toBe(8000);
  expect(boot.repayDueTick).toBe(28);
  expect(boot.repayAmount).toBe(1000);
  expect(boot.villageLevel).toBe(1);

  // Requirement #6: stocks, the newspaper and the 税率 lever are all hidden.
  await expect(page.getByRole('button', { name: '買う' })).toHaveCount(0);
  await expect(page.getByText('⚙️ 税率レバー')).toBeHidden();
  await expect(page.getByText('⚙️ 金利レバー')).toBeHidden();

  await expect(page.getByText('火の消えかけたネコ村へようこそ')).toBeVisible();
  await page.getByRole('button', { name: /はじめる/ }).click();

  // --- Stage 1: the one obvious action is talking to ミケ, then investing ---
  await expect(page.getByText('🎯 ミケに話しかけて、お店に投資しよう')).toBeVisible();
  await page.getByRole('button', { name: /ミケに話しかける/ }).click();
  await page.getByRole('button', { name: /300CC投資する/ }).click();
  await expect(page.getByText('投資ってなに？')).toBeVisible();

  const afterInvest = await neko(page);
  expect(Math.round(afterInvest.player.cash)).toBe(775);
  expect(afterInvest.placements.some((p) => p.kind === 'soupFactory')).toBe(true);
  expect(afterInvest.tutorial.dividend).toBe(5);
  expect(afterInvest.tutorial.phase).toBe('advance');
  await page.getByRole('button', { name: /次へ/ }).click();

  // --- Stage 2: 「1日進める」 pays the dividend (775 -> 780, 28 -> 27) ---
  await page.getByRole('button', { name: /1日進める/ }).click();
  await expect(page.getByText(/日目の収支/)).toBeVisible();
  const afterDay1 = await neko(page);
  expect(afterDay1.tick).toBe(1);
  expect(Math.round(afterDay1.player.cash)).toBe(780);
  expect(afterDay1.tutorial.phase).toBe('roads');

  // --- Stage 3: connect the 石畳, which raises the dividend 5 -> 10 ---
  await page.getByRole('button', { name: /石畳でつなぐ/ }).click();
  await expect(page.getByText('物流ってなに？')).toBeVisible();
  const afterRoads = await neko(page);
  expect(afterRoads.roads.length).toBeGreaterThan(0);
  expect(afterRoads.tutorial.dividend).toBe(10);
  expect(afterRoads.tutorial.phase).toBe('repayWait');
  await page.getByRole('button', { name: /次へ/ }).click();

  // --- Advance day-by-day to the repayment deadline ---
  const advance = page.getByRole('button', { name: /1日進める/ });
  for (let i = 0; i < 40; i++) {
    if ((await neko(page)).tutorial.phase === 'repayment') break;
    await advance.click();
  }
  const atRepay = await neko(page);
  expect(atRepay.tutorial.phase).toBe('repayment');
  expect(atRepay.tick).toBe(28);
  expect(atRepay.player.cash).toBeGreaterThanOrEqual(1000);

  // Still no stock market mid-tutorial.
  await expect(page.getByRole('button', { name: '買う' })).toHaveCount(0);

  // --- Stage 4: repay たぬきち and unlock the village ---
  await expect(page.getByText('約束の返済日ニャ。1000CC払うニャ。')).toBeVisible();
  await page.getByRole('button', { name: /1000CC返済する/ }).click();
  await expect(page.getByText('チュートリアル完了！')).toBeVisible();
  const afterRepay = await neko(page);
  expect(afterRepay.villageLevel).toBe(2);
  expect(Math.round(afterRepay.player.loan)).toBe(7000);

  await page.getByRole('button', { name: /フリープレイをはじめる/ }).click();
  await page.waitForFunction(() => window.__neko?.tutorial.active === false, undefined, {
    timeout: 10_000,
  });

  // --- Free play: 金利 lever + news unlock; stocks stay locked until level 3 ---
  await expect(page.getByText('⚙️ 金利レバー')).toBeVisible();
  await expect(page.getByRole('button', { name: '買う' })).toHaveCount(0);
});
