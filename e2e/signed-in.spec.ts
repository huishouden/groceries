import { expect, test, type Page } from '@playwright/test';
import { useTestHousehold } from '@huishouden/pwa-kit/e2e';

// Signed in as the invented people of a household of this run's own (pwa-kit STANDARD.md
// "Staging"), against the real rules: on the emulators (`bun run e2e:emulator`), and on
// staging for what needs the suite's site (@staging) or a kit bump (@smoke).
const hh = useTestHousehold(test);

/** The household's Groceries list; the first to open the new household adds the default lists. */
async function openGroceries(page: Page) {
  const restore = page.getByRole('button', { name: 'Add the default lists' });
  const groceries = page.getByRole('button', { name: /^Groceries/ }).first();
  await expect(restore.or(groceries)).toBeVisible({ timeout: 30_000 });
  if (await restore.isVisible()) await restore.click();
  await groceries.click();
  await expect(page.locator('main').getByRole('heading', { name: 'Groceries' })).toBeVisible();
}

async function addItem(page: Page, name: string) {
  await page.getByLabel('New item').fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('main li', { hasText: name })).toBeVisible();
}

test('a grocery item one member adds shows for the other, and checking it off syncs back', { tag: '@smoke' }, async ({ browser }) => {
  const page = await hh.open(browser, 'admin');
  await openGroceries(page);
  await addItem(page, 'Test oats');

  // Saved in the household, not just on this screen: the other member's own browser shows it.
  const theirs = await hh.open(browser, 'member');
  await openGroceries(theirs);
  await expect(theirs.locator('main li', { hasText: 'Test oats' })).toBeVisible({ timeout: 20_000 });
  await theirs.getByRole('button', { name: 'Mark Test oats done' }).click();
  await expect(page.getByRole('button', { name: 'Mark Test oats not done' })).toBeVisible({ timeout: 20_000 });
});

test('a helper ticks off a member’s item and adds their own, but can’t delete the member’s or set up lists', async ({ browser }) => {
  const page = await hh.open(browser, 'admin');
  await openGroceries(page);
  await addItem(page, 'Test rice');

  const helper = await hh.open(browser, 'helper');
  await openGroceries(helper);
  await expect(helper.locator('main li', { hasText: 'Test rice' })).toBeVisible({ timeout: 20_000 });
  // Refused: deleting the admin's item and setting up lists; the reason is shown where lists are set up.
  await expect(helper.getByRole('button', { name: 'Delete Test rice' })).toHaveCount(0);
  await expect(helper.getByRole('button', { name: 'New list' })).toHaveCount(0);
  await expect(helper.getByText('Only admins and members can change settings.')).toBeVisible();
  // Permitted: ticking the admin's item off, and adding and deleting one of their own.
  await helper.getByRole('button', { name: 'Mark Test rice done' }).click();
  await expect(page.getByRole('button', { name: 'Mark Test rice not done' })).toBeVisible({ timeout: 20_000 });
  await addItem(helper, 'Test juice');
  await expect(page.locator('main li', { hasText: 'Test juice' })).toBeVisible({ timeout: 20_000 });
  await helper.getByRole('button', { name: 'Delete Test juice' }).click();
  await expect(page.locator('main li', { hasText: 'Test juice' })).toHaveCount(0, { timeout: 20_000 });
});

// @staging: the portal's To-do list is another app on the suite's site.
test('what is left to buy shows as one Groceries line on the portal’s To-do list', { tag: '@staging' }, async ({ browser }) => {
  const page = await hh.open(browser, 'admin');
  await openGroceries(page);
  await addItem(page, 'Test lentils');

  // Groceries stays open to publish (a few seconds after the change); the portal is at / on the same site.
  const portal = await hh.open(browser, 'admin', '/todo');
  const line = portal.getByRole('listitem', { name: /^Groceries:/ });
  await expect(line, 'the Groceries line on the To-do list').toHaveCount(1, { timeout: 30_000 });
  await expect(line).toHaveAccessibleName(/^Groceries: \d+ things? on the list$/);
  await expect(line.locator('a[href*="/groceries/"]').first()).toBeVisible();
  await expect(line.locator('[data-todo-action]')).toHaveCount(0);
});
