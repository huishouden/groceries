import { expect, test, type Page } from '@playwright/test';

// The view and the list on screen live in the address (kit STANDARD.md "Updates"), so a reload (a
// new version) and Back return to them. The signed-out sample household.

const current = (page: Page) => page.locator('nav[slot="nav"] button[aria-current="page"]');
const heading = (page: Page) => page.locator('main').getByRole('heading', { level: 1 });

test('a reload and Back return to the screen in the address', async ({ page }) => {
  await page.goto('./');
  await expect(current(page)).toHaveText('Lists');
  await expect(page).toHaveURL(/\?mode=lists&list=groceries$/);
  await page.locator('nav[aria-label="Lists"]').getByRole('button', { name: /Pantry Restock/ }).click();
  await expect(heading(page)).toHaveText('Pantry Restock');
  await page.locator('nav[slot="nav"]').getByRole('button', { name: 'Kitchen' }).click();
  await expect(page).toHaveURL(/mode=hub/);
  await page.reload();
  await expect(current(page)).toHaveText('Kitchen');
  await page.goBack();
  await expect(current(page)).toHaveText('Lists');
  await expect(heading(page)).toHaveText('Pantry Restock');
  await page.goBack();
  await expect(heading(page)).toHaveText('Groceries');
  await page.goForward();
  await page.goForward();
  await expect(current(page)).toHaveText('Kitchen');
});

test('a list the household does not have is corrected in the address and not remembered', async ({ page }) => {
  await page.goto('./?mode=lists&list=pantry');
  await expect(heading(page)).toHaveText('Pantry Restock');
  await page.goto('./?mode=lists&list=no-such-list');
  await expect(page).toHaveURL(/\?mode=lists&list=pantry$/);
  await page.goto('./');
  await expect(page).toHaveURL(/\?mode=lists&list=pantry$/);
});
