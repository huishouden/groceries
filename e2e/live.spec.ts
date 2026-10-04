import { expect, test } from '@playwright/test';
import { expectBottomNav, expectCleanLoad, expectCompactSampleBanner, expectGoogleSignInPopup, expectHuishoudenFrame, expectInstallable, expectSecurityHeaders, expectThemeConsistent } from '@huishouden/pwa-kit/e2e';
import { SUITE_ORIGIN } from '@huishouden/pwa-kit/site';

// Smoke tests of the deployed site (the kit runs them after every deploy with BASE_URL set).
// Read-only: they stop at Google's account picker and never sign in or write data.

test('loads with no runtime errors', async ({ page }) => {
  await expectCleanLoad(page);
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('is installable with the suite name and icons', async ({ page, request }) => {
  await expectInstallable(page, request);
  const manifest = await (await request.get('manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Huishouden Groceries', short_name: 'Groceries', description: 'What to get, and where it is' });
});

test('Google sign-in is reachable for this domain', async ({ page, context }) => {
  await expectGoogleSignInPopup(page, context, (p) => p.getByRole('button', { name: 'Sign in with Google' }).click());
});

test('opens in the Huishouden frame', async ({ page }) => {
  await expectHuishoudenFrame(page, { app: 'Groceries', portalUrl: '/', path: './' });
});

test('follows the suite theme: dark on a dark device, readable', ({ page }) => expectThemeConsistent(page, { path: './' }));

test('a shared link shows a preview', async ({ page, request }) => {
  await page.goto('./');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', 'What to get, and where it is');
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toBe(`${SUITE_ORIGIN}/groceries/og.png`);
  expect((await request.get('og.png')).ok()).toBe(true);
});

test('signed out, it opens on the invented sample household', async ({ page }) => {
  const firestore: string[] = [];
  page.on('request', (r) => r.url().includes('firestore.googleapis.com') && firestore.push(r.url()));
  await page.goto('./');
  await expect(page.getByText('Sample data')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('main').getByRole('heading', { name: 'Groceries' })).toBeVisible();
  await page.getByLabel('New item').fill('Sample oats');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('main li', { hasText: 'Sample oats' })).toBeVisible();
  // The sample never reaches a server.
  expect(firestore).toEqual([]);
});

test('sends the security headers and leaves sign-in un-framed', ({ request }) => expectSecurityHeaders(request, './', { geolocation: true }));

test('signed out, the Sample data banner is one line on a phone', ({ page }) => expectCompactSampleBanner(page, './'));

test('on a phone the four modes are a bottom bar', ({ page }) => expectBottomNav(page, { path: './', labels: ['Lists', 'Kitchen', 'Store', 'Meals'] }));
