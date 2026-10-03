import { afterAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase/app';
import { collection, disableNetwork, doc, getDocFromCache, getDocsFromCache, initializeFirestore, memoryLocalCache, setDoc } from 'firebase/firestore';
import { HouseholdRepo } from '../../src/data/store';
import { CATEGORIES, URGENCY, itemData, type ListItem, type Staple } from '../../src/data/model';

// The repo's writes on a Firestore that never goes online, read back from its cache.
const app = initializeApp({ apiKey: 'test', projectId: 'demo-staples-test', appId: 'test' }, 'staples-test');
const db = initializeFirestore(app, { localCache: memoryLocalCache() });
await disableNetwork(db);
afterAll(() => deleteApp(app));

const settle = () => new Promise((r) => setTimeout(r, 20));
const stapleRef = (household: string, id: string) => doc(db, 'households', household, 'staples', id);
const staples = async (household: string) => (await getDocsFromCache(collection(db, 'households', household, 'staples'))).docs.map((d) => d.id);

describe('forgetStaple', () => {
  it('removes a suggestion, and Undo puts it back as it was', async () => {
    const repo = new HouseholdRepo(db, 'h1', true);
    const milk: Staple = { id: 'milk', displayName: 'Milk', category: CATEGORIES.DAIRY_EGGS, defaultQuantity: '1', timesAdded: 7, timesCompleted: 6, lastAddedAt: 5 };
    const { id, ...data } = milk;
    void setDoc(stapleRef('h1', id), data);
    await settle();

    repo.forgetStaple('milk');
    await settle();
    expect((await getDocFromCache(stapleRef('h1', 'milk'))).exists()).toBe(false);

    repo.restoreStaple(milk);
    await settle();
    expect((await getDocFromCache(stapleRef('h1', 'milk'))).data()).toEqual(data);
  });
});

describe('learning staples', () => {
  it("learns from Groceries' own lists only", async () => {
    const repo = new HouseholdRepo(db, 'h2', true);
    repo.addItem({ listId: 'groceries', listIcon: 'grocery', name: 'Eggs', addedBy: 'Alex' });
    repo.addItem({ listId: 'chores', listIcon: 'chores', name: 'Bring clothes to drycleaners', addedBy: 'Alex' });
    repo.addItem({ listId: 'notes', listIcon: 'notes', name: 'Call the plumber', addedBy: 'Alex' });
    await settle();
    expect(await staples('h2')).toEqual(['eggs']);
  });

  it('counts a checked-off item only when it is on one of those lists', async () => {
    const repo = new HouseholdRepo(db, 'h3', true);
    const item: ListItem = { id: 'i1', listId: 'chores', name: 'Unload', category: CATEGORIES.OTHER, quantity: '1', notes: '', addedBy: 'Alex', completed: false, urgency: URGENCY.NORMAL, createdAt: 1, updatedAt: 1, completedAt: null };
    void setDoc(doc(db, 'households', 'h3', 'items', 'i1'), itemData(item));
    await settle();
    repo.toggleCompleted(item, false);
    await settle();
    expect(await staples('h3')).toEqual([]);
    repo.toggleCompleted({ ...item, listId: 'groceries', name: 'Butter', completed: false }, true);
    await settle();
    expect(await staples('h3')).toEqual(['butter']);
  });
});
