// Read budgets of Groceries' own sync paths (pwa-kit STANDARD.md "Read budgets"), on the emulators
// with the household's rules (`bun run e2e:emulator` runs `vitest run test/emulator` after the
// signed-in specs, inside the `firebase emulators:exec` of `hh dev evidence`): the publish of planned dinners and the to-buy line, bringing Google
// tasks in, and deleting a list with its items. Reads are counted from the SDK's own results and
// snapshots as Firestore bills them (`readCounter().sdk`); the interleaving tests land another
// member's write before each read. `vi.mock` replaces firebase/firestore with the counted module for
// this file, the kit's modules included (inlined by vite.config.ts). Invented data on a fixed day. A change that raises a ceiling
// says why in its PR.
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { collection, connectFirestoreEmulator, initializeFirestore, memoryLocalCache, onSnapshot, terminate, type Firestore } from 'firebase/firestore';
import { expectReads, writeBeforeEachRead } from '@huishouden/pwa-kit/read-test';
import { e2eProject, e2eTarget, seedTestHousehold, testHousehold, writeTestDocs, type TestHousehold } from '@huishouden/pwa-kit/staging';
import { agendaDoc } from '@huishouden/pwa-kit/agenda';
import { todoDoc } from '@huishouden/pwa-kit/todos';
import type { GoogleTask } from '@huishouden/pwa-kit/google-tasks';
import { CATEGORIES, DEFAULT_LISTS, URGENCY, type ListItem, type ShoppingList } from '../../src/data/model';
import type { PlannedMeal } from '../../src/data/mealPlan';
import { publishAgenda, publishTodos } from '../../src/data/publishSync';
import { bringInTasks, markHandled, toTasksSettings, watchTasksSettings, type TasksSettings } from '../../src/data/googleTasks';
import { HouseholdRepo, type NewItem } from '../../src/data/store';

const { counter } = await vi.hoisted(async () => ({ counter: (await import('@huishouden/pwa-kit/read-test')).readCounter() }));
vi.mock('firebase/firestore', async (original) => counter.sdk(await original<object>()));

const emulator = e2eTarget() === 'emulator';
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
const DAY = 86_400_000;
// 10:30 tomorrow, local time: the counts don't hang on when the test runs.
const NOW = new Date(new Date().setHours(0, 0, 0, 0) + DAY + 10.5 * 3_600_000).getTime();
const ymd = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// The rules take only the suite's own addresses.
const URL = 'https://huishouden-staging.web.app/groceries/';

let hh: TestHousehold;
let app: FirebaseApp;
let db: Firestore;
let admin: string;

const lists: ShoppingList[] = DEFAULT_LISTS.filter((l) => l.icon !== 'chores').map((l) => ({ ...l, createdAt: NOW - 30 * DAY }));
const item = (id: string, listId: string, name: string, extra: Partial<ListItem> = {}): ListItem => ({
  id, listId, name, category: CATEGORIES.OTHER, quantity: '1', notes: '', addedBy: 'Test', completed: false, urgency: URGENCY.NORMAL, createdAt: NOW - DAY, updatedAt: NOW - DAY, completedAt: null, ...extra,
});
const items: ListItem[] = [item('i1', 'groceries', 'Test oats'), item('i2', 'groceries', 'Test milk'), item('i3', 'pantry', 'Test rice'), item('i4', 'hardware', 'Test filter'), item('i5', 'groceries', 'Test bread', { completed: true, completedAt: NOW - DAY })];
// Dinners planned for the next five days.
const plan: PlannedMeal[] = [0, 1, 2, 3, 4].map((i) => ({ day: ymd(NOW + i * DAY), type: 'dinner', name: `Test dinner ${i}`, meal: { name: `Test dinner ${i}` } as PlannedMeal['meal'], by: 'seed@example.com', updatedAt: NOW - DAY }));

const strip = ({ id: _id, ...d }: { id: string }) => d;

beforeAll(async () => {
  if (!emulator) return;
  const household = testHousehold('groceries-reads-sdk');
  admin = household.users.admin.email;
  const docs: Record<string, Record<string, unknown>> = {};
  for (const l of lists) docs[`lists/${l.id}`] = strip(l);
  for (const i of items) docs[`items/${i.id}`] = { ...strip(i), by: admin };
  docs['settings/tasks'] = { googleTasks: [{ googleListId: 'g-shop', title: 'Shopping', listId: 'groceries', mode: 'add' }], handled: [], updatedAt: NOW - DAY, by: admin };
  hh = await seedTestHousehold({ household, docs });
  app = initializeApp({ apiKey: 'demo-key', projectId: e2eProject(), appId: 'demo' }, `reads-${hh.id}`);
  db = initializeFirestore(app, { localCache: memoryLocalCache() });
  connectFirestoreEmulator(db, process.env.HH_EMULATOR_HOST || '127.0.0.1', Number(process.env.HH_EMULATOR_FIRESTORE_PORT || 8080), {
    mockUserToken: { sub: hh.users.admin.uid, email: admin, email_verified: true },
  });
});

afterAll(async () => {
  if (!emulator) return;
  await terminate(db);
  await deleteApp(app);
});

type Store = Parameters<typeof publishAgenda>[4];
const publish = (published: NonNullable<Store>['published'] = null) =>
  Promise.all([publishAgenda(db, hh.id, admin, plan, { now: NOW, published }), publishTodos(db, hh.id, admin, lists, items, { now: NOW, published })]);

describe.skipIf(!emulator)('publishing (planned dinners, the to-buy line): one query each, none when this device already published the same', () => {
  test("first, again, and again with this device's note", async () => {
    await expectReads(() => publish(), { max: 2, min: 2, counter, label: 'Groceries publish, first' });
    // Again: the five dinners and the one to-buy line.
    const { value, reads } = await expectReads(() => publish(), { max: 6, min: 6, counter, label: 'Groceries publish, again' });
    expect(reads).toBe(value[0].unchanged + value[1].unchanged);
    const notes = new Map<string, string>();
    const store = { getItem: (k: string) => notes.get(k) ?? null, setItem: (k: string, v: string) => void notes.set(k, v), removeItem: (k: string) => void notes.delete(k), key: (i: number) => [...notes.keys()][i] ?? null, clear: () => notes.clear(), get length() { return notes.size; } };
    await publish(store);
    await expectReads(() => publish(store), { max: 0, counter, label: 'Groceries publish, published' });
  });

  test("interleaving: another member's stray agenda item and to-do land before each read; each list read once", async () => {
    let n = 0;
    const stray = (i: number) => ({
      [`agenda/groceries_stray${i}`]: agendaDoc('groceries', { ref: `stray${i}`, kind: 'other', title: `Old ${i}`, start: NOW + DAY, allDay: true, url: URL }, admin, NOW),
      [`todos/groceries:stray${i}`]: todoDoc('groceries', { ref: `stray${i}`, title: `Old ${i}`, createdAt: NOW - DAY, url: URL }, admin, NOW),
    });
    const { value } = await expectReads(() => publish(), { max: 10, min: 10, counter, label: 'Groceries publish with a write before each read', beforeRead: writeBeforeEachRead(() => writeTestDocs(hh, stray(++n))) });
    // Both reads go out together, so each saw both strays (6 + 4 reads) and removed them.
    expect(n).toBe(2);
    expect(value.map((r) => r.deleted)).toEqual([2, 2]);
  });
});

describe.skipIf(!emulator)('bringing Google tasks in: no reads of its own; the listeners bill each change once', () => {
  test('three tasks, then the same three from another device: three items, each change read once', async () => {
    const tasks: GoogleTask[] = ['eggs', 'butter', 'apples'].map((name, i) => ({ id: `t${i}`, listId: 'g-shop', title: `Test ${name}`, notes: '', updated: NOW } as GoogleTask));
    const links = [{ googleListId: 'g-shop', title: 'Shopping', listId: 'groceries', mode: 'add' as const }];
    const device = (settings: () => TasksSettings) => {
      const repo = new HouseholdRepo(db, hh.id);
      return { addItem: (input: NewItem) => repo.addItem(input), markHandled: (ids: string[]) => markHandled(db, hh.id, settings(), ids, admin) };
    };
    // This device's listeners as the app has them on every screen (useHouseholdData's items and
    // staples, the Google Tasks settings), already started.
    let seen = 0;
    let settingsSeen = 0;
    let settings = toTasksSettings(undefined);
    const stops = [
      onSnapshot(collection(db, 'households', hh.id, 'items'), (s) => (seen = s.docs.filter((d) => d.id.startsWith('gt-')).length)),
      onSnapshot(collection(db, 'households', hh.id, 'staples'), () => {}),
      watchTasksSettings(db, hh.id, (s) => ((settings = s), settingsSeen++)),
    ];
    const until = async (ok: () => boolean) => {
      for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 25));
    };
    await until(() => settingsSeen > 0);
    await new Promise((r) => setTimeout(r, 300));
    const { reads } = await expectReads(
      async () => {
        await bringInTasks(device(() => settings), links, lists, tasks, { addedBy: 'Test', by: admin });
        await until(() => seen === 3 && settings.handled.length === 3);
        // Another device brings in the same tasks at once: the same three items and staples.
        await bringInTasks(device(() => toTasksSettings(undefined)), links, lists, tasks, { addedBy: 'Test', by: admin });
        await new Promise((r) => setTimeout(r, 1000));
      },
      { max: 14, min: 14, counter, label: 'bringing Google tasks in' },
    );
    // Nothing read by the bring-in itself: this device's listeners bill each new item, its staple
    // and the settings once (7), and again when the other device writes the same documents (7).
    // Three items, not six.
    expect(reads).toBe(14);
    expect(seen).toBe(3);
    expect(settings.handled).toHaveLength(3);
    stops.forEach((stop) => stop());
  });
});

describe.skipIf(!emulator)('deleting a list: one query of its items, then one batch', () => {
  test("interleaving: another member adds an item to it before the read; it's read and deleted with the rest", async () => {
    await writeTestDocs(hh, { 'lists/costco': strip(lists.find((l) => l.id === 'costco')!), 'items/c1': { ...strip(item('c1', 'costco', 'Test towels')), by: admin }, 'items/c2': { ...strip(item('c2', 'costco', 'Test soap')), by: admin } });
    const repo = new HouseholdRepo(db, hh.id);
    await expectReads(() => repo.deleteList('costco'), {
      max: 3,
      min: 3,
      counter,
      label: 'deleting a list with a write before its read',
      beforeRead: writeBeforeEachRead(() => writeTestDocs(hh, { 'items/c3': { ...strip(item('c3', 'costco', 'Test paper')), by: admin } })),
    });
    const left = await fetch(`http://${process.env.HH_EMULATOR_HOST || '127.0.0.1'}:${process.env.HH_EMULATOR_FIRESTORE_PORT}/v1/projects/${e2eProject()}/databases/(default)/documents/households/${hh.id}/items/c3`, { headers: { Authorization: 'Bearer owner' } });
    expect(left.status).toBe(404);
  });
});
