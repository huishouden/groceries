import { expect, test } from '@playwright/test';
import { expectLocalized } from '@huishouden/pwa-kit/e2e';
import es from '../src/locales/es.json' with { type: 'json' };
import nl from '../src/locales/nl.json' with { type: 'json' };

// The signed-out sample household in Spanish and Dutch: Groceries' own chrome and the kit's, no
// English left. Item names, staples and the sample's meal ideas are household data and stay as entered.
const fixedTime = '2031-01-06T10:00:00';
const ENGLISH = ['Lists', 'Kitchen', 'Store', 'Meals', 'New list', 'Running low', 'Produce & Greens', 'Dairy & Eggs', 'to get', 'Share', 'Typical store', 'in cart'];

for (const [lang, m] of [
  ['es', es],
  ['nl', nl],
] as const) {
  test(`the sample in ${lang}`, async ({ page }) => {
    await page.clock.setFixedTime(fixedTime);
    await expectLocalized(page, lang, { words: ENGLISH });
    await expect(page.locator('main').getByRole('heading', { level: 1 })).toHaveText(m['defaultList.groceries']);
    await expect(page.getByRole('button', { name: m['modes.store'], exact: true }).first()).toBeVisible();

    // Store mode: sections in the reader's language, in walking order.
    await page.getByRole('button', { name: m['modes.store'], exact: true }).first().click();
    await expect(page.getByText(m['store.typical'], { exact: true })).toBeVisible();
    await expect(page.locator('main h2').filter({ hasText: m['category.produce'] }).first()).toBeVisible();

    // An item's dialog: sections and buttons translated, the item's name as entered.
    await page.getByRole('button', { name: m['modes.lists'], exact: true }).first().click();
    await page.getByRole('button', { name: m['item.edit'].replace('{name}', 'Baby spinach'), exact: true }).click();
    const dialog = page.getByRole('dialog', { name: m['item.editTitle'] });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: lang === 'es' ? 'Guardar' : 'Opslaan', exact: true })).toBeVisible();
    await expect(dialog.getByRole('combobox').first().locator('option', { hasText: m['category.produce'] })).toHaveCount(1);
  });
}
