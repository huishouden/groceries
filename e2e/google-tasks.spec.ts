import { addItem, createHousehold, expect, readHouseholdDoc, seedHouseholdDoc, signIn, test } from './fixtures';

// Google Tasks has no emulator: the kit's stand-ins answer instead (window.__mockGoogleTasksToken,
// __mockGoogleTaskLists, __mockGoogleTasks), as Google would to a member who connected.
const row = (page: import('@playwright/test').Page, name: string) => page.locator('main li').filter({ has: page.getByText(name, { exact: true }) });

test('groceries told to an assistant land on the list; a Google list Tasks takes to-dos from stays Tasks’', async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await addItem(page, 'Whole milk');
  // Huishouden Tasks already offers "My Tasks" for its Chores & Notes list (the same settings document).
  const tasksLink = { googleListId: 'g-my', title: 'My Tasks', listId: 'chores', mode: 'suggest' };
  await seedHouseholdDoc('settings/tasks', { googleTasks: [tasksLink], handled: [], updatedAt: 1, by: 'alice@example.com' });
  await page.evaluate(() => {
    const at = Date.now();
    window.__mockGoogleTasksToken = 'tasks-token';
    window.__mockGoogleTaskLists = [
      { id: 'g-my', title: 'My Tasks' },
      { id: 'g-shop', title: 'Shopping' },
    ];
    window.__mockGoogleTasks = [
      { id: 'eggs-1', listId: 'g-shop', title: 'Eggs', notes: '', updated: at - 3000, completed: false },
      { id: 'dentist-1', listId: 'g-my', title: 'Call the dentist', notes: 'Ask about Tuesday', due: '2031-05-16', updated: at - 2000, completed: false },
    ];
  });

  await page.getByRole('button', { name: 'Groceries settings' }).click();
  const settings = page.getByRole('region', { name: 'Google Tasks', exact: true });
  await settings.getByRole('button', { name: 'Connect Google Tasks' }).click();
  await expect(settings).toContainText('My Tasks: goes to Chores & Notes in Tasks');
  await expect(settings.getByLabel('Bring My Tasks into')).toHaveCount(0);
  await settings.getByLabel('Bring Shopping into').selectOption({ label: 'Add to Groceries' });
  await expect(settings).toContainText('New tasks in Shopping go straight onto Groceries.');
  await page.getByRole('button', { name: 'Close' }).click();

  // Added without asking, in its aisle; Tasks' to-do is neither added nor offered here.
  await expect(row(page, 'Eggs')).toContainText('Dairy & Eggs');
  await expect(page.getByRole('region', { name: 'New in Google Tasks' })).toHaveCount(0);
  await expect(page.getByText('Call the dentist')).toHaveCount(0);

  // Saving Groceries' link kept Tasks' link as it was.
  await expect
    .poll(async () => ((await readHouseholdDoc('settings/tasks'))?.googleTasks as unknown[] | undefined) ?? [])
    .toEqual(expect.arrayContaining([tasksLink, { googleListId: 'g-shop', title: 'Shopping', listId: 'groceries', mode: 'add' }]));

  // Cleared from the list, a task taken in does not come back.
  await page.getByRole('button', { name: 'Mark Eggs done' }).click();
  await page.getByRole('button', { name: /Clear done/ }).click();
  await page.reload();
  await expect(page.locator('main li', { hasText: 'Whole milk' })).toBeVisible();
  await expect(row(page, 'Eggs')).toHaveCount(0);
});
