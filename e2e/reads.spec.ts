import { expect, test, type Browser, type Page } from '@playwright/test';
import { expectPageReads, useTestHousehold } from '@huishouden/pwa-kit/e2e';
import { testHousehold } from '@huishouden/pwa-kit/staging';

// Read budgets (pwa-kit STANDARD.md "Read budgets"): what opening Groceries costs a household in
// Firestore reads, on the emulators with a build that counts them (`expectPageReads`), each in a
// fresh browser context (a first open, nothing cached). A change that raises a ceiling says why in
// its PR. An invented household: four shopping lists and Tasks' chores list, six items on them (one
// bought) and two chores, three staples, a store with two learned aisles, two saved meal ideas, a
// favorite, three dinners planned this week, the Google Tasks settings.
const NOW = Date.now();
const DAY = 86_400_000;
const ymd = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const { admin } = testHousehold('reads').users;
const by = admin.email;

const list = (id: string, name: string, icon: string, sortOrder: number) => ({ [`lists/${id}`]: { name, description: '', icon, color: '#2d6a4f', sortOrder, createdAt: NOW - 30 * DAY } });
const item = (id: string, listId: string, name: string, completed = false) => ({
  [`items/${id}`]: { listId, name, category: 'Other', quantity: '1', notes: '', addedBy: 'Test', by, completed, urgency: 0, position: -(NOW - DAY), createdAt: NOW - DAY, updatedAt: NOW - DAY, completedAt: completed ? NOW - 3_600_000 : null },
});
const staple = (key: string, name: string) => ({ [`staples/${key}`]: { displayName: name, category: 'Other', defaultQuantity: '1', timesAdded: 3, lastAddedAt: NOW - DAY } });
const meal = (name: string) => ({ type: 'dinner', name, parts: [{ ingredients: ['Test rice'], prep: 'Simmered' }] });
const dinner = (i: number) => ({ [`mealPlan/${ymd(NOW + i * DAY)}_dinner`]: { day: ymd(NOW + i * DAY), type: 'dinner', name: `Test dinner ${i}`, meal: meal(`Test dinner ${i}`), by, updatedAt: NOW - DAY } });

const hh = useTestHousehold(test, {
  scope: 'reads',
  docs: {
    ...list('groceries', 'Groceries', 'grocery', 0),
    ...list('pantry', 'Pantry Restock', 'pantry', 1),
    ...list('costco', 'Costco & Bulk', 'bulk', 2),
    ...list('hardware', 'Hardware & Home', 'hardware', 3),
    ...list('chores', 'Chores & Notes', 'chores', 4),
    ...item('i1', 'groceries', 'Test oats'),
    ...item('i2', 'groceries', 'Test milk'),
    ...item('i3', 'groceries', 'Test bread', true),
    ...item('i4', 'pantry', 'Test rice'),
    ...item('i5', 'costco', 'Test towels'),
    ...item('i6', 'hardware', 'Test filter'),
    ...item('t1', 'chores', 'Test sweep'),
    ...item('t2', 'chores', 'Test mow'),
    ...staple('test-oats', 'Test oats'),
    ...staple('test-milk', 'Test milk'),
    ...staple('test-rice', 'Test rice'),
    'stores/s1': { name: 'Test Market', categoryOrder: [], aisleLabels: {}, location: null, osmId: null, address: '', createdAt: NOW - 30 * DAY },
    'stores/s1/aisles/test-oats': { aisle: '4', name: 'Test oats', updatedAt: NOW - DAY, updatedBy: by },
    'stores/s1/aisles/test-milk': { aisle: '9', name: 'Test milk', updatedAt: NOW - DAY, updatedBy: by },
    'menus/m1': { createdAt: NOW - 2 * DAY, createdBy: by, ingredients: ['Test rice'], meals: [meal('Test pilaf')] },
    'menus/m2': { createdAt: NOW - DAY, createdBy: by, ingredients: ['Test oats'], meals: [meal('Test porridge')] },
    'favorites/test-pilaf': { meal: meal('Test pilaf'), savedAt: NOW - DAY, savedBy: by },
    ...dinner(0),
    ...dinner(1),
    ...dinner(2),
    'settings/tasks': { googleTasks: [], handled: [], updatedAt: NOW - DAY, by },
  },
});

// One open at a time: another open's writes (a sign-in's profile, its publish) would reach this
// page's listeners and be counted as its reads.
test.describe.configure({ mode: 'serial', timeout: 90_000 });

const loaded = (page: Page) => expect(page.getByRole('button', { name: /^Groceries/ }).first()).toBeVisible({ timeout: 30_000 });

// Each person has used Groceries before on another device: a first sign-in's own writes are done,
// so they don't land in a measured open as changes its listeners bill, early or late.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  for (const as of ['admin', 'member', 'helper', 'kid'] as const) {
    const page = await hh.open(browser, as);
    await loaded(page);
    await page.waitForTimeout(4500);
    await page.close();
  }
});

async function firstOpen(browser: Browser, as: 'admin' | 'member' | 'helper' | 'kid', path: string, ready: (page: Page) => Promise<unknown>, max: number, label: string) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const page = await context.newPage();
    // Past the agenda and to-do publish, 3 s after the data settles (store.ts PUBLISH_DELAY_MS).
    return await expectPageReads(page, async () => {
      await hh.signIn(page, as, path);
      await ready(page);
    }, { max, min: max, label, settleMs: 4500 });
  } finally {
    await context.close();
  }
}

// Every mode mounts the same listeners: the household, the lists (5), every item on them, Tasks'
// to-dos too (8), staples (3), stores (1), saved meal ideas (2), favorites (1), this week's plan
// (3), the food settings and the Google Tasks settings: 26. Then the publish's two queries of what
// Groceries put on the agenda (3 dinners) and the to-do list (one line): 30. A store's learned
// aisles are read only once shopping there starts. Helpers and kids read the same.
for (const [mode, ready] of [
  ['', loaded],
  ['?mode=meals', (p: Page) => expect(p.getByText('Test dinner 1').first()).toBeVisible({ timeout: 30_000 })],
  ['?mode=store', (p: Page) => expect(p.getByText('Test Market').first()).toBeVisible({ timeout: 30_000 })],
  ['?mode=hub', loaded],
] as const) {
  test(`opening Groceries${mode ? ` at ${mode.slice(6)}` : ' (Lists)'}, signed in as an admin`, async ({ browser }) => {
    await firstOpen(browser, 'admin', `./${mode}`, ready, 30, `Groceries ${mode || 'Lists'}, admin`);
  });
}

for (const as of ['member', 'helper', 'kid'] as const) {
  test(`opening Groceries (Lists), signed in as a ${as}`, async ({ browser }) => {
    await firstOpen(browser, as, './', loaded, 30, `Groceries Lists, ${as}`);
  });
}
