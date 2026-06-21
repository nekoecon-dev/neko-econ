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
 * Smoke-test the life-mode prototype: `/` boots a cosy village with only the
 * four life-HUD items, the economy UI fully hidden, a working inventory toggle,
 * and a 「1日進める」 button that visibly changes the day.
 */
test('life mode boots with a minimal HUD and a working day loop', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__neko !== undefined, undefined, { timeout: 30_000 });

  const boot = await neko(page);
  expect(boot.life.active).toBe(true);
  expect(boot.life.day).toBe(1);
  expect(boot.life.items.length).toBeGreaterThan(0); // gatherables on the map

  // The four life HUD items are present...
  await expect(page.getByText('今日の目的')).toBeVisible();
  await expect(page.getByText(/1日目/)).toBeVisible();
  await expect(page.getByText(/CC/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /インベントリ/ })).toBeVisible();

  // ...and the economy UI is fully hidden.
  await expect(page.getByText('NekoEcon')).toHaveCount(0); // economy header gone
  await expect(page.getByRole('button', { name: '買う' })).toHaveCount(0); // no stock market
  await expect(page.getByText('⚙️ 金利レバー')).toBeHidden(); // no interest lever
  await expect(page.getByText('⚙️ 税率レバー')).toBeHidden(); // no tax lever

  // Inventory toggles open and lists the gatherables (count entries).
  await page.getByRole('button', { name: /インベントリ/ }).click();
  await expect(page.getByText(/きのこ ×/)).toBeVisible();

  // 「1日進める」 advances the day and fires a visible event toast.
  await page.getByRole('button', { name: /1日進める/ }).click();
  await page.waitForFunction(() => (window.__neko?.life.day ?? 0) >= 2, undefined, {
    timeout: 10_000,
  });
  const after = await neko(page);
  expect(after.life.day).toBe(2);
  expect(after.life.event).not.toBeNull();
});
