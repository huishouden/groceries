import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Signed out, on the invented sample household: nothing here touches the emulators' data.

const ready = (p: Page) => expect(p.getByText('Sample data')).toBeVisible({ timeout: 15_000 });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await ready(page);
});

test('in Store mode, what is left comes first and done sections fold into In cart', async ({ page }) => {
  await page.getByRole('button', { name: 'Store', exact: true }).click();
  // Check off everything but the frozen peas.
  for (const name of ['Eggs', 'Whole milk', 'Bananas', 'Baby spinach', 'Sourdough bread', 'Chicken thighs', 'Greek yogurt', 'Coffee beans']) {
    await page.getByRole('button', { name: `Mark ${name} done` }).click();
  }
  await expect(page.getByText(/^11 of 12 in cart$/)).toBeVisible();
  const rows = page.getByRole('button', { name: /^Mark .* (not )?done$/ });
  await expect(rows.first()).toHaveAccessibleName('Mark Frozen peas done');
  await expect(rows.first()).toBeInViewport();
  await expect(page.locator('h2').filter({ hasText: /left/ })).toHaveText([/Frozen Foods/]);

  // Checked items wait folded; opening the group lets one be un-checked.
  const inCart = page.getByRole('button', { name: 'In cart (11)' });
  await expect(inCart).toHaveAttribute('aria-expanded', 'false');
  await inCart.click();
  await page.getByRole('button', { name: 'Mark Eggs not done' }).click();
  await expect(page.getByText(/^10 of 12 in cart$/)).toBeVisible();
  await expect(page.locator('h2').filter({ hasText: /left/ })).toHaveText([/Dairy & Eggs/, /Frozen Foods/]);
});

test('with a single shopping list, no list picker shows; New list stays', async ({ page }) => {
  // Leave only Groceries.
  for (const name of ['Pantry Restock', 'Costco & Bulk', 'Hardware & Home']) {
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Delete list' }).click();
  }
  await expect(page.locator('main h1')).toHaveText('Groceries');
  await expect(page.getByRole('button', { name: /^Groceries/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ New list' })).toBeVisible();

  await page.getByRole('button', { name: 'Store', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Groceries');
  await expect(page.getByRole('button', { name: /^Groceries/ })).toHaveCount(0);
});
