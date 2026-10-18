import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isUrgent, itemNeedBy, needByFields, sortItems, URGENCY, type ListItem, type ShoppingList } from '../../src/data/model';
import { todoItems } from '../../src/data/publish';

// The day a shopping item is needed by (@huishouden/pwa-kit/need-by), as Groceries writes, sorts and
// counts it. 2031-01-04 is a Saturday; the tests run in UTC, so the device's calendar is UTC's.
const SAT = '2031-01-04';
const noon = (ymd: string) => Date.parse(`${ymd}T12:00:00Z`);
const NOW = noon(SAT);

const item = (id: string, extra: Partial<ListItem> = {}): ListItem => ({
  id,
  listId: 'groceries',
  name: id,
  category: 'Other',
  quantity: '1',
  notes: '',
  addedBy: 'Alex',
  completed: false,
  urgency: URGENCY.NORMAL,
  createdAt: NOW - 3 * 86_400_000,
  updatedAt: NOW - 3 * 86_400_000,
  completedAt: null,
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('needByFields: what a new or edited item writes', () => {
  it('a later day: the day, with Standard for older apps', () => {
    expect(needByFields({ needBy: '2031-01-06' })).toEqual({ needBy: '2031-01-06', urgency: URGENCY.NORMAL });
  });
  it('today: Need Today, so older apps show it as urgent', () => {
    expect(needByFields({ needBy: SAT })).toEqual({ needBy: SAT, urgency: URGENCY.URGENT });
  });
  it('no day on a new item: Standard or Whenever, and no needBy written', () => {
    expect(needByFields({ needBy: undefined, urgency: URGENCY.WHENEVER })).toEqual({ needBy: null, urgency: URGENCY.WHENEVER });
    expect(needByFields({})).toEqual({ urgency: URGENCY.NORMAL });
  });
  it('clearing the day of an edited item keeps its Whenever', () => {
    expect(needByFields({ needBy: null }, item('Soap', { urgency: URGENCY.WHENEVER, needBy: '2031-01-06' }))).toEqual({ needBy: null, urgency: URGENCY.WHENEVER });
  });
  it('an edit that leaves the day alone pins an older "Need Today" to the day it was set', () => {
    const older = item('Milk', { urgency: URGENCY.URGENT, updatedAt: noon('2031-01-02') });
    expect(needByFields({}, older)).toEqual({ needBy: '2031-01-02' });
  });
});

describe('itemNeedBy and isUrgent', () => {
  it('a day in the future is not urgent; today and past days are', () => {
    expect(isUrgent(item('a', { needBy: '2031-01-06' }), SAT)).toBe(false);
    expect(isUrgent(item('b', { needBy: SAT, urgency: URGENCY.URGENT, updatedAt: NOW }), SAT)).toBe(true);
    expect(isUrgent(item('c', { needBy: '2031-01-02', urgency: URGENCY.NORMAL }), SAT)).toBe(true);
  });
  it('an older "Need Today" set two days ago is overdue now, not needed today for ever', () => {
    const older = item('Milk', { urgency: URGENCY.URGENT, updatedAt: noon('2031-01-02') });
    expect(itemNeedBy(older, SAT)).toEqual({ day: '2031-01-02', guessed: true });
    expect(isUrgent(older, SAT)).toBe(true);
  });
  it('a bought item is never urgent', () => {
    expect(isUrgent(item('d', { needBy: SAT, completed: true }), SAT)).toBe(false);
  });
});

describe('sortItems: needed soonest first, then the household order', () => {
  it('overdue, today, then the coming days by day; undated and far-off items keep their order after', () => {
    const items = [
      item('undated-first', { position: 1 }),
      item('tuesday', { needBy: '2031-01-07', position: 2 }),
      item('next-month', { needBy: '2031-02-01', position: 3 }),
      item('today', { needBy: SAT, urgency: URGENCY.URGENT, updatedAt: NOW, position: 4 }),
      item('undated-second', { position: 5 }),
      item('overdue', { needBy: '2031-01-03', position: 6 }),
      item('monday', { needBy: '2031-01-06', position: 7 }),
    ];
    expect(sortItems(items, SAT).map((i) => i.id)).toEqual(['overdue', 'today', 'monday', 'tuesday', 'undated-first', 'next-month', 'undated-second']);
  });
});

describe("todoItems: Groceries' line on the household to-do list", () => {
  const lists: ShoppingList[] = [{ id: 'groceries', name: 'Groceries', icon: 'grocery', sortOrder: 0 } as ShoppingList];
  it('counts what is needed today or overdue, not what is needed later', () => {
    const items = [item('Deodorant', { needBy: '2031-01-06' }), item('Eggs', { needBy: SAT, urgency: URGENCY.URGENT, updatedAt: NOW }), item('Bread')];
    expect(todoItems(lists, items, NOW)[0].detail).toBe('Need today: 1');
    expect(todoItems(lists, items, noon('2031-01-06'))[0].detail).toBe('Need today: 2');
  });
});
