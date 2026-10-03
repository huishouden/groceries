import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Signed out, on the invented sample household: nothing here touches the emulators' data.

const ready = (p: Page) => expect(p.getByText('Sample data')).toBeVisible({ timeout: 15_000 });
const shelf = (p: Page) => p.getByRole('region', { name: 'Frequent items' });
const undoBar = (p: Page) => p.getByRole('status').filter({ hasText: 'Undo' });

async function longPress(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await ready(page);
});

test("a long press on a suggestion offers Don't suggest, and Undo brings it back", async ({ page }) => {
  const butter = shelf(page).getByRole('button', { name: 'Add Butter' });
  await expect(butter).toBeVisible();
  await longPress(page, butter);
  const sheet = page.getByRole('dialog', { name: 'Butter' });
  await expect(sheet).toContainText('Adding it again brings it back.');
  // The press did not add it.
  await expect(page.getByRole('button', { name: 'Mark Butter done' })).toHaveCount(0);
  await sheet.getByRole('button', { name: "Don't suggest Butter" }).click();
  await expect(butter).toHaveCount(0);
  await expect(undoBar(page)).toContainText('Won\'t suggest "Butter"');

  await undoBar(page).getByRole('button', { name: 'Undo' }).click();
  await expect(butter).toBeVisible();
});

test('Edit shows an × on each suggestion; a right-click opens the sheet too', async ({ page }) => {
  await shelf(page).getByRole('button', { name: 'Edit suggestions' }).click();
  await shelf(page).getByRole('button', { name: "Don't suggest Apples" }).click();
  await expect(shelf(page).getByRole('button', { name: 'Add Apples' })).toHaveCount(0);
  await shelf(page).getByRole('button', { name: 'Done editing suggestions' }).click();
  await expect(shelf(page).getByRole('button', { name: /^Don't suggest/ })).toHaveCount(0);

  await shelf(page).getByRole('button', { name: 'Add Pasta' }).click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'Pasta' })).toBeVisible();
  await page.keyboard.press('Escape');
  // A tap still adds.
  await shelf(page).getByRole('button', { name: 'Add Pasta' }).click();
  await expect(page.getByRole('button', { name: 'Mark Pasta done' })).toBeVisible();
});

test('the add bar’s suggestions each have an × that stops suggesting it', async ({ page }) => {
  await page.getByLabel('New item').fill('ch');
  await expect(page.locator('ul.absolute li')).toContainText(['Cheddar cheese']);
  await page.getByRole('button', { name: "Don't suggest Cheddar cheese" }).click();
  await expect(page.getByRole('button', { name: "Don't suggest Cheddar cheese" })).toHaveCount(0);
  await expect(undoBar(page)).toContainText('Won\'t suggest "Cheddar cheese"');
  await expect(page.getByLabel('New item')).toBeFocused();
});

test('chores learned when Tasks and Groceries were one app are never suggested', async ({ page }) => {
  // Both are staples in the sample: one filed under Chores & Tasks, one named like a to-do on Tasks' list.
  for (const name of ['Unload the dishwasher', 'Take coats to the dry cleaner']) {
    await expect(shelf(page).getByRole('button', { name: `Add ${name}` })).toHaveCount(0);
  }
  await expect(shelf(page).getByRole('button', { name: /^Add / }).first()).toBeVisible();
  for (const query of ['unload', 'dry clean']) {
    await page.getByLabel('New item').fill(query);
    await page.waitForTimeout(200);
    await expect(page.locator('ul.absolute')).toHaveCount(0);
  }
  // Nor is the to-do itself on any Groceries list.
  await expect(page.getByText('Take coats to the dry cleaner')).toHaveCount(0);
});
