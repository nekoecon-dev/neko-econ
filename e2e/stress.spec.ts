import { test, expect } from '@playwright/test';
import type { GameState } from '../src/types/game';

// The game loop exposes its live state on window.__neko for these tests.
declare global {
  interface Window {
    __neko?: GameState;
  }
}

const TARGET_TICKS = 1000;

test('1000-tick stress run: economy stays within sane bounds', async ({ page }) => {
  // ?turbo=5 speeds the tick loop up so 1000 ticks run in seconds.
  await page.goto('/?turbo=5');

  // Wait for the loop to start exposing state, then run to the target tick.
  await page.waitForFunction(() => window.__neko !== undefined, undefined, {
    timeout: 30_000,
  });
  await page.waitForFunction(
    (target) => (window.__neko?.tick ?? 0) >= target,
    TARGET_TICKS,
    { timeout: 120_000 },
  );

  const state = (await page.evaluate(() => window.__neko)) as GameState;
  const { economy, cats } = state;
  // eslint-disable-next-line no-console
  console.log(
    `[stress] tick=${state.tick} price=${economy.soupPrice} infl=${economy.inflationRate}% ` +
      `unemp=${economy.unemploymentRate}% gini=${economy.gini} totalMoney=${economy.totalMoney} ` +
      `bankrupt=${cats.filter((c) => c.money <= 0).length}/${cats.length}`,
  );

  // Loop is alive.
  expect(state.tick).toBeGreaterThanOrEqual(TARGET_TICKS);

  // No runaway inflation: price is finite and well below the hard clamp (9999).
  expect(Number.isFinite(economy.soupPrice)).toBe(true);
  expect(economy.soupPrice).toBeGreaterThan(0);
  expect(economy.soupPrice).toBeLessThan(500);
  expect(Number.isFinite(economy.inflationRate)).toBe(true);

  // Money supply never drains negative.
  expect(economy.totalMoney).toBeGreaterThanOrEqual(0);

  // Not every cat is bankrupt (no total collapse).
  const bankrupt = cats.filter((c) => c.money <= 0).length;
  expect(bankrupt).toBeLessThan(cats.length);

  // Indicators stay in their valid ranges.
  expect(economy.gini).toBeGreaterThanOrEqual(0);
  expect(economy.gini).toBeLessThanOrEqual(1);
  expect(economy.unemploymentRate).toBeGreaterThanOrEqual(0);
  expect(economy.unemploymentRate).toBeLessThanOrEqual(100);
});

test('issuing currency raises the money supply', async ({ page }) => {
  await page.goto('/?turbo=50');
  await page.waitForFunction(() => window.__neko !== undefined, undefined, {
    timeout: 30_000,
  });

  const before = (await page.evaluate(() => window.__neko?.economy.totalMoney ?? 0)) as number;

  const button = page.getByRole('button', { name: /全員に配布/ });
  await button.click();
  await button.click();
  await button.click();

  // Allow a tick to process, then read again. Three clicks add 1500 CC, which
  // dwarfs per-tick noise.
  await page.waitForTimeout(300);
  const after = (await page.evaluate(() => window.__neko?.economy.totalMoney ?? 0)) as number;

  expect(after).toBeGreaterThan(before + 1000);
});
