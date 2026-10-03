import { createHousehold, expect, seedHouseholdDoc, signIn, test } from './fixtures';

// Groceries and Huishouden Tasks read the same household lists: to-do lists (chores, notes) are
// Tasks', every other list is Groceries'.

test('to-do lists and their items stay in Tasks, one tap away', async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  const item = (listId: string, name: string, category: string) => ({
    listId, name, category, quantity: '1', notes: '', addedBy: 'Alice', by: 'alice@example.com', completed: false,
    urgency: 'Standard', position: 1, createdAt: 1, updatedAt: 1, completedAt: null,
  });
  await seedHouseholdDoc('items/plumber', { ...item('chores', 'Call the plumber', 'Chores & Tasks'), dueAt: Date.now() + 3_600_000, allDay: false });
  await seedHouseholdDoc('items/bread', item('groceries', 'Sourdough bread', 'Bakery & Bread'));

  await expect(page.locator('main li', { hasText: 'Sourdough bread' })).toBeVisible();
  await expect(page.locator('nav[aria-label="Lists"] > button')).toHaveText([/^Groceries/, /^Pantry Restock/, /^Costco & Bulk/, /^Hardware & Home/, 'New list', 'Reorder lists']);
  await expect(page.getByText('Call the plumber')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'To-dos and chores are in Tasks' })).toHaveAttribute('href', '/tasks/');

  // A new list here is a shopping list: only shopping kinds are offered.
  await page.getByRole('button', { name: 'New list' }).click();
  const dialog = page.getByRole('dialog', { name: 'New list' });
  for (const kind of ['grocery', 'pantry', 'bulk', 'hardware']) await expect(dialog.getByRole('button', { name: kind, exact: true })).toBeVisible();
  for (const kind of ['chores', 'notes']) await expect(dialog.getByRole('button', { name: kind, exact: true })).toHaveCount(0);
});

test('on a phone, Tasks is at the end of the list chips', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await expect(page.getByRole('link', { name: 'To-dos are in Tasks' })).toHaveAttribute('href', '/tasks/');
});
