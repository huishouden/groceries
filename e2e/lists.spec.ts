import { addItem, createHousehold, expect, signIn, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
});

test('a new list is selected and receives the items added next', async ({ page }) => {
  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByPlaceholder(/Target, Home Depot/).fill('Farmers Market');
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page.getByRole('heading', { name: 'Farmers Market', level: 1 })).toBeVisible();
  await addItem(page, 'Heirloom tomatoes');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Farmers Market', level: 1 })).toBeVisible();
  await expect(page.locator('main li', { hasText: 'Heirloom tomatoes' })).toBeVisible();
});
