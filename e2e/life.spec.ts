import { test, expect } from '@playwright/test';
import type { GameState } from '../src/types/game';

declare global {
  interface Window {
    __neko?: GameState;
  }
}

const neko = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__neko) as Promise<GameState>;

/**
 * Smoke-test the life-mode DAY1 boot: `/` opens the cosy village on DAY1 with
 * the minimal HUD (cash / day / single objective / inventory), the welcome
 * story beat, a working inventory, the economy UI fully hidden, and the
 * advance button gated until the day's objective is met.
 */
test('life mode boots into the DAY1 campaign with a minimal HUD', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__neko !== undefined, undefined, { timeout: 30_000 });

  const boot = await neko(page);
  expect(boot.life.active).toBe(true);
  expect(boot.life.day).toBe(1);
  expect(boot.life.level).toBe(1);
  expect(boot.life.playerName).toBe(''); // name not entered yet
  expect(boot.life.items.length).toBeGreaterThan(0); // big mushrooms to find

  // Name entry → confirm.
  await expect(page.getByText('きみの名前を教えてニャ')).toBeVisible();
  await page.getByPlaceholder('ニャオ').fill('テストにゃん');
  await page.getByRole('button', { name: 'けってい' }).click();
  expect((await neko(page)).life.playerName).toBe('テストにゃん');

  // DAY1 opening conversation (uses the name) → click through all 4 lines.
  await expect(page.getByText(/ようこそ、テストにゃんさん/)).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: /つぎへ|きのこを集めにいく/ }).click();
  }

  // Minimal HUD: day + the single objective, currency shown as ニャル.
  await expect(page.getByText('DAY1')).toBeVisible();
  await expect(page.getByText(/きのこを3つ集めよう/)).toBeVisible();
  await expect(page.getByText(/ニャル/).first()).toBeVisible();

  // Economy UI is fully hidden (the "3D村" header badge is economy-mode only).
  await expect(page.getByText('3D村')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '買う' })).toHaveCount(0);
  await expect(page.getByText('⚙️ 金利レバー')).toBeHidden();
  await expect(page.getByText('⚙️ 税率レバー')).toBeHidden();

  // The advance button is gated until the day's objective is done.
  await expect(page.getByRole('button', { name: /目的をクリア/ })).toBeDisabled();

  // Inventory toggles open and lists the gatherables.
  await page.getByRole('button', { name: /インベントリ/ }).click();
  await expect(page.getByText(/きのこ ×/)).toBeVisible();
});
