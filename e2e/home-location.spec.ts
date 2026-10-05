import type { Page } from '@playwright/test';
import { stubOpenStreetMap, useGeolocation } from '@huishouden/pwa-kit/e2e';
import { expect, test } from './fixtures';

// Saved stores are measured from the household's home when the device's location isn't allowed,
// from the device when it is. Signed out, on the invented sample household: its home is
// 12 Example Lane, Springfield; Sample Foods is 0.7 mi from it, Example Market 1.8 mi.

const ready = (p: Page) => expect(p.getByText('Sample data')).toBeVisible({ timeout: 15_000 });
const storeChips = (p: Page) => p.getByRole('region', { name: 'Store' }).getByRole('button', { name: /^(Sample Foods|Example Market)/ });

test('without location, stores are nearest home first, and no store is detected', async ({ page }) => {
  const asked = await stubOpenStreetMap(page);
  await page.goto('./');
  await ready(page);
  await page.getByRole('button', { name: 'Store', exact: true }).click();

  await expect(storeChips(page)).toHaveText(['Sample Foods · 0.7 mi', 'Example Market · 1.8 mi']);
  await expect(page.getByTestId('store-distances')).toHaveText('Nearest first, from home');
  // "At a store?" needs the device's own position: nothing is offered or picked from home.
  await expect(page.getByRole('region', { name: 'Detected store' })).toHaveCount(0);
  await expect(page.getByText(/Shopping at (Sample Foods|Example Market)/)).toHaveCount(0);
  expect(asked).toEqual([]);
});

test('with location allowed, stores are measured from where the device is', async ({ page, context }) => {
  await stubOpenStreetMap(page);
  // Across town, nearer Example Market than Sample Foods (and not in either).
  await useGeolocation(context, { lat: 39.765, lng: -89.69 });
  await page.goto('./');
  await ready(page);
  await page.getByRole('button', { name: 'Store', exact: true }).click();

  await expect(storeChips(page)).toHaveText([/^Example Market · 0\.\d mi$/, /^Sample Foods · \d\.\d mi$/]);
  await expect(page.getByTestId('store-distances')).toHaveText('Nearest first, from where you are');
});
