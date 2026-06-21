import { test, expect } from '@playwright/test';
import type { GameState } from '../src/types/game';

// The game loop exposes its live state on window.__neko for these tests.
declare global {
  interface Window {
    __neko?: GameState;
  }
}

/**
 * Walk the guided story tutorial from the very first card to free play, asserting
 * it never breaks: intro → invest in ミケ → lay the 石畳 → raise the rate →
 * repay たぬきち → village unlocked (level 2, シロ, stock market).
 */
test('story tutorial runs start to finish without breaking', async ({ page }) => {
  await page.goto('/');

  await page.waitForFunction(() => window.__neko !== undefined, undefined, {
    timeout: 30_000,
  });

  // Boots straight into the tutorial intro (sim paused).
  const boot = (await page.evaluate(() => window.__neko)) as GameState;
  expect(boot.tutorial.active).toBe(true);
  expect(boot.tutorial.phase).toBe('intro');
  expect(Math.round(boot.player.cash)).toBe(606);
  expect(Math.round(boot.player.loan)).toBe(9000);
  expect(boot.villageLevel).toBe(1);

  // ---- Intro ----
  await expect(page.getByText('火の消えかけたネコ村へようこそ')).toBeVisible();
  await page.getByRole('button', { name: /はじめる/ }).click();

  // ---- Mission 1: talk to ミケ, then invest 300CC ----
  await page.getByRole('button', { name: /ミケに話しかける/ }).click();
  await page.getByRole('button', { name: /投資する/ }).click();
  await expect(page.getByText('投資ってなに？')).toBeVisible();

  // The shop is built, タマ is hired, and the dividend has started.
  const afterInvest = (await page.evaluate(() => window.__neko)) as GameState;
  expect(Math.round(afterInvest.player.cash)).toBe(306);
  expect(afterInvest.placements.some((p) => p.kind === 'soupFactory')).toBe(true);
  expect(afterInvest.tutorial.dividend).toBeGreaterThan(0);
  await page.getByRole('button', { name: /次へ/ }).click();

  // ---- Mission 2: lay the 石畳 ----
  const roadsBefore = (await page.evaluate(() => window.__neko?.roads.length ?? 0)) as number;
  await page.getByRole('button', { name: /石畳の道を敷く/ }).click();
  await expect(page.getByText('物流ってなに？')).toBeVisible();
  const roadsAfter = (await page.evaluate(() => window.__neko?.roads.length ?? 0)) as number;
  expect(roadsAfter).toBeGreaterThan(roadsBefore);
  await page.getByRole('button', { name: /次へ/ }).click();

  // ---- Mission 3: raise the interest rate (inflation has crossed 5%) ----
  const rateBefore = (await page.evaluate(
    () => window.__neko?.policy.interestRate ?? 0,
  )) as number;
  await page.getByRole('button', { name: /金利を上げる/ }).click();
  await expect(page.getByText('金利ってなに？')).toBeVisible();
  const afterRate = (await page.evaluate(() => window.__neko)) as GameState;
  expect(afterRate.policy.interestRate).toBeGreaterThan(rateBefore);
  expect(afterRate.economy.inflationRate).toBeLessThanOrEqual(5);
  await page.getByRole('button', { name: /次へ/ }).click();

  // ---- Repayment day: pay たぬきち 1,000CC ----
  await page.getByRole('button', { name: /1000CC返済する/ }).click();
  await expect(page.getByText('チュートリアル完了！')).toBeVisible();
  await page.getByRole('button', { name: /フリープレイをはじめる/ }).click();

  // ---- Free play unlocked ----
  await page.waitForFunction(() => window.__neko?.tutorial.active === false, undefined, {
    timeout: 10_000,
  });
  const done = (await page.evaluate(() => window.__neko)) as GameState;
  expect(done.villageLevel).toBe(2);
  expect(Math.round(done.player.loan)).toBe(8000);
  expect(done.cats.some((c) => c.name === 'シロ')).toBe(true);

  // The stock market is now live (its buy buttons appear).
  await expect(page.getByRole('button', { name: '買う' }).first()).toBeVisible();
});
