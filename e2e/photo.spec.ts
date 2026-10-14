import { expect, test, type Page, type Route } from '@playwright/test';
import { join } from 'node:path';
import { useTestHousehold } from '@huishouden/pwa-kit/e2e';
import { PRODUCT_PHOTO_PATH, type ProductPhotoResponse } from '@huishouden/pwa-kit/product-photo-core';
import { EMULATOR_PHOTO_ENDPOINT } from '../src/lib/photoEndpoint';

// Add by photo, signed in as a test household's invented people. On the emulators the Worker is
// answered here (what it said for the same invented photo on staging); on staging (@staging) the
// real Worker and model read e2e/fixtures/photos/, and SHOTS=<dir> keeps screenshots for the PR.
const hh = useTestHousehold(test);
const PHOTOS = join(import.meta.dirname, 'fixtures', 'photos');
const SHOTS = process.env.SHOTS;

const READ: ProductPhotoResponse = {
  photos: [{ products: [{ name: 'Coffee mate Italian Sweet Crème creamer, Zero Sugar', category: 'Dairy & Eggs' }, { name: 'Reddi-wip Original Whipped Topping', category: 'Dairy & Eggs' }] }],
  left: 24,
};

/** The Worker, answered by `answer`; each request's body kept. */
async function worker(page: Page, answer: ProductPhotoResponse) {
  const sent: { household: string; photos: string[]; categories: string[] }[] = [];
  await page.route(`${EMULATOR_PHOTO_ENDPOINT}${PRODUCT_PHOTO_PATH}`, (route: Route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ json: answer, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  return sent;
}

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

async function choosePhotos(page: Page, ...names: string[]) {
  await page.getByRole('button', { name: 'Add by photo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add by photo' });
  await expect(dialog.getByText('sent once to Cloudflare')).toBeVisible();
  await dialog.getByLabel('Product photos').setInputFiles(names.map((n) => join(PHOTOS, `${n}.jpg`)));
  return dialog;
}

const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
};

test('Add by photo: both products from one photo come back ticked; one already on the list is skipped; nothing is added before the tap', async ({ browser }) => {
  const page = await hh.open(browser, 'member');
  const sent = await worker(page, READ);
  await openGroceries(page);
  await addItem(page, 'Reddi-wip Original');

  const dialog = await choosePhotos(page, 'creamer-and-whipped');
  await expect(dialog.getByText('Found 2 items')).toBeVisible({ timeout: 20_000 });
  // One photo, made small on the device: a JPEG data URL, with the app's aisles to choose from.
  expect(sent).toHaveLength(1);
  expect(sent[0].photos[0]).toMatch(/^data:image\/jpeg;base64,/);
  expect(sent[0].photos[0].length).toBeLessThan(200_000);
  expect(sent[0].categories).toContain('Dairy & Eggs');

  const creamer = dialog.getByRole('checkbox', { name: 'Add Coffee mate Italian Sweet Crème creamer, Zero Sugar' });
  const whipped = dialog.getByRole('checkbox', { name: 'Add Reddi-wip Original Whipped Topping' });
  await expect(creamer).toBeChecked();
  await expect(whipped).not.toBeChecked();
  await expect(dialog.getByText('Already on list')).toBeVisible();
  await expect(page.locator('main li', { hasText: 'Coffee mate' })).toHaveCount(0);

  // The name and quantity are editable before adding.
  await dialog.getByLabel('Quantity').first().fill('2');
  await dialog.getByRole('button', { name: 'Add 1 item' }).click();
  await expect(dialog).toHaveCount(0);
  const added = page.locator('main li', { hasText: 'Coffee mate Italian Sweet Crème creamer, Zero Sugar' });
  await expect(added).toBeVisible();
  await expect(page.locator('main li', { hasText: 'Reddi-wip' })).toHaveCount(1);
});

test("Add by photo: the household's day used up says so, and Type instead goes to the add field", async ({ browser }) => {
  const page = await hh.open(browser, 'admin');
  await worker(page, { photos: [{ capped: true }], capped: 'household', left: 0 });
  await openGroceries(page);
  const dialog = await choosePhotos(page, 'whipped');
  await expect(dialog.getByText("Your household has used today's photo reading. Type the items instead")).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole('button', { name: 'Type instead' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('New item')).toBeFocused();
});

test('Add by photo: a barcode the phone reads is looked up in Open Food Facts, and the photo never leaves the device', async ({ browser }) => {
  const page = await hh.open(browser, 'kid');
  // Chromium's BarcodeDetector needs a platform detector the test browser lacks: a stand-in that finds the jar's code.
  await page.addInitScript(() => {
    class FakeDetector {
      static async getSupportedFormats() {
        return ['ean_13', 'upc_a'];
      }
      async detect() {
        return [{ rawValue: '3017620422003', format: 'ean_13' }];
      }
    }
    Object.assign(window, { BarcodeDetector: FakeDetector });
  });
  const looked: string[] = [];
  await page.route('https://world.openfoodfacts.org/**', (route) => {
    looked.push(route.request().url());
    return route.fulfill({ path: join(import.meta.dirname, 'fixtures', 'off', '3017620422003.json'), headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  const sent = await worker(page, READ);
  await page.reload();
  await openGroceries(page);
  const dialog = await choosePhotos(page, 'barcode');
  await expect(dialog.getByText('Found 1 item')).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByText('From the barcode')).toBeVisible();
  await expect(dialog.getByLabel('Name')).toHaveValue('Nutella');
  expect(looked).toHaveLength(1);
  expect(looked[0]).toContain('/api/v2/product/3017620422003.json');
  expect(sent).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Add 1 item' }).click();
  await expect(page.locator('main li', { hasText: 'Nutella' })).toBeVisible();
});

// @staging: the real Worker and model, on the invented photos (the evidence's screenshots).
test('Add by photo on staging: the model reads the creamer and the whipped cream from one photo', { tag: '@staging' }, async ({ browser }) => {
  test.setTimeout(90_000);
  const page = await hh.open(browser, 'admin');
  await openGroceries(page);
  await addItem(page, 'Test bananas');
  await expect(page.getByRole('button', { name: 'Add by photo' })).toBeVisible();
  await shot(page, 'camera-button');

  const dialog = await choosePhotos(page, 'creamer-and-whipped');
  await shot(page, 'picker');
  await expect(dialog.getByText(/^Found \d+ items?/)).toBeVisible({ timeout: 60_000 });
  const names = await dialog.getByLabel('Name').evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value));
  expect(names.some((n) => /coffee mate/i.test(n) && /creamer/i.test(n))).toBe(true);
  expect(names.some((n) => /reddi-wip/i.test(n))).toBe(true);
  await shot(page, 'checklist');
  await dialog.getByRole('button', { name: /^Add \d+ items?$/ }).click();
  await expect(page.locator('main li', { hasText: /Coffee mate/i })).toBeVisible();
  await shot(page, 'added');
});
