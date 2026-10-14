import { describe, expect, test } from 'vitest';
import { alreadyListed, photoCategory } from '../../src/data/photoItems';
import { CATEGORIES, URGENCY, type ListItem, type Staple } from '../../src/data/model';

// Add by photo: where a product read from a photo starts, and whether it is already on the list.
const staple = (displayName: string, category: Staple['category']): Staple => ({ id: displayName.toLowerCase(), displayName, category, defaultQuantity: '1', timesAdded: 3, timesCompleted: 2, lastAddedAt: 0 });
const item = (name: string, over: Partial<ListItem> = {}): ListItem => ({
  id: name,
  listId: 'groceries',
  name,
  category: CATEGORIES.OTHER,
  quantity: '1',
  notes: '',
  addedBy: 'Test',
  completed: false,
  urgency: URGENCY.NORMAL,
  position: 0,
  createdAt: 0,
  updatedAt: 0,
  completedAt: null,
  ...over,
});

describe('photoCategory', () => {
  test("the household's own aisle for that name comes first", () => {
    expect(photoCategory({ name: 'Reddi-wip Original', category: CATEGORIES.DAIRY_EGGS, photo: 0, via: 'photo' }, [staple('reddi-wip original', CATEGORIES.FROZEN)])).toBe(CATEGORIES.FROZEN);
  });

  test("then the model's section, when it is one of the app's and not Other", () => {
    expect(photoCategory({ name: 'Coffee mate Italian Sweet Crème creamer, Zero Sugar', category: CATEGORIES.DAIRY_EGGS, photo: 0, via: 'photo' }, [])).toBe(CATEGORIES.DAIRY_EGGS);
    expect(photoCategory({ name: 'Heinz Tomato Ketchup', category: 'Condiments', photo: 0, via: 'photo' }, [])).toBe(CATEGORIES.PANTRY);
  });

  test("a barcode's categories, through the word list", () => {
    expect(photoCategory({ name: 'Nutella', photo: 0, via: 'barcode', hints: ['hazelnut spreads', 'sweet spreads', 'spreads'] }, [])).not.toBe(CATEGORIES.OTHER);
  });
});

describe('alreadyListed', () => {
  test('an open item on this list with the same product; not a bought one, not another list', () => {
    const items = [item('Coffee mate creamer'), item('Reddi-wip Original', { completed: true }), item('Heinz Ketchup', { listId: 'costco' })];
    expect(alreadyListed('Coffee mate Italian Sweet Crème creamer, Zero Sugar', items, 'groceries')).toBe(true);
    expect(alreadyListed('Reddi-wip Original Whipped Topping', items, 'groceries')).toBe(false);
    expect(alreadyListed('Heinz Ketchup', items, 'groceries')).toBe(false);
  });
});
