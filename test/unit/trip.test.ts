import { describe, expect, it } from 'vitest';
import { CATEGORIES, URGENCY, type ListItem } from '../../src/data/model';
import { groupWithAisles, leftFirst } from '../../src/data/stores';
import { TRIP_GAP_MS, TRIP_MAX_MS, boughtThisTrip, storeItems, tripProgress, tripStart } from '../../src/data/trip';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// An invented Saturday, 11:00.
const NOW = new Date('2031-01-11T11:00:00').getTime();

let seq = 0;
function item(name: string, extra: Partial<ListItem> = {}): ListItem {
  return {
    id: `i${++seq}`,
    listId: 'groceries',
    name,
    category: CATEGORIES.PRODUCE,
    quantity: '1',
    notes: '',
    addedBy: 'Sam',
    completed: false,
    urgency: URGENCY.NORMAL,
    createdAt: NOW - 2 * DAY,
    updatedAt: NOW - 2 * DAY,
    completedAt: null,
    ...extra,
  };
}
const boughtAgo = (name: string, ago: number, extra: Partial<ListItem> = {}) => item(name, { completed: true, completedAt: NOW - ago, ...extra });

describe('tripStart', () => {
  it('is null when nothing is ticked off, or nothing in the last three hours', () => {
    expect(tripStart([], NOW)).toBeNull();
    expect(tripStart([item('Eggs')], NOW)).toBeNull();
    expect(tripStart([boughtAgo('Bananas', 11 * DAY), boughtAgo('Milk', TRIP_GAP_MS)], NOW)).toBeNull();
  });

  it('begins at the first check-off after a gap of three hours or more', () => {
    const items = [boughtAgo('Old', 11 * DAY), boughtAgo('Yesterday', DAY), boughtAgo('First', 40 * MIN), boughtAgo('Second', 25 * MIN), boughtAgo('Third', 2 * MIN)];
    expect(tripStart(items, NOW)).toBe(NOW - 40 * MIN);
  });

  it('keeps a long shop as one trip while something is ticked off every hour or two', () => {
    // A five-hour run across two stores: never three hours without a check-off.
    const items = [5, 4, 2.5, 1, 0.1].map((h) => boughtAgo(`At ${h}h`, h * HOUR));
    expect(tripStart(items, NOW)).toBe(NOW - 5 * HOUR);
  });

  it('two people ticking off at once on different lists make one trip, the same on every device', () => {
    const alex = [boughtAgo('Bread', 30 * MIN), boughtAgo('Cheese', 10 * MIN)];
    const sam = [boughtAgo('Rice', 28 * MIN, { listId: 'costco' }), boughtAgo('Towels', 5 * MIN, { listId: 'costco' })];
    expect(tripStart([...alex, ...sam], NOW)).toBe(NOW - 30 * MIN);
    expect(tripStart([...sam, ...alex].reverse(), NOW)).toBe(NOW - 30 * MIN);
  });

  it('a morning trip is over by the evening one', () => {
    const morning = [boughtAgo('Coffee', 9 * HOUR), boughtAgo('Eggs', 8.5 * HOUR)];
    const evening = [boughtAgo('Pasta', 20 * MIN)];
    expect(tripStart([...morning, ...evening], NOW)).toBe(NOW - 20 * MIN);
  });

  it('never reaches back more than twelve hours, however steady the ticking', () => {
    const allDay = Array.from({ length: 16 }, (_, h) => boughtAgo(`Hour ${h}`, h * HOUR + MIN));
    expect(tripStart(allDay, NOW)).toBe(NOW - 11 * HOUR - MIN);
    expect(NOW - tripStart(allDay, NOW)!).toBeLessThanOrEqual(TRIP_MAX_MS);
  });

  it("counts a check-off stamped a little in the future (another device's clock) as now", () => {
    expect(tripStart([boughtAgo('Ahead', -2 * MIN), boughtAgo('Before', 2 * HOUR)], NOW)).toBe(NOW - 2 * HOUR);
  });

  it('leaves out items done without a time', () => {
    expect(tripStart([item('Legacy', { completed: true, completedAt: null })], NOW)).toBeNull();
    expect(boughtThisTrip(item('Legacy', { completed: true, completedAt: null }), NOW - HOUR)).toBe(false);
  });
});

describe('storeItems and tripProgress', () => {
  // The reported case: last trip's ticked-off bananas and avocados among this week's.
  const list = [
    boughtAgo('bananas', 11 * DAY),
    boughtAgo('3 avocados', 11 * DAY),
    item('Bananas'),
    item('Avocado', { quantity: '2' }),
    item('Milk', { category: CATEGORIES.DAIRY_EGGS }),
  ];

  it('shows only what is left when no trip is running, and counts only that', () => {
    const shown = storeItems(list, tripStart(list, NOW));
    expect(shown.map((i) => i.name)).toEqual(['Bananas', 'Avocado', 'Milk']);
    expect(tripProgress(shown)).toEqual({ done: 0, total: 3 });
  });

  it('keeps an item ticked off this trip, so it can be un-ticked, and counts it in the cart', () => {
    const now = list.map((i) => (i.name === 'Bananas' ? { ...i, completed: true, completedAt: NOW - MIN } : i));
    const shown = storeItems(now, tripStart(now, NOW));
    expect(shown.map((i) => `${i.name}${i.completed ? ' ✓' : ''}`)).toEqual(['Bananas ✓', 'Avocado', 'Milk']);
    expect(tripProgress(shown)).toEqual({ done: 1, total: 3 });
    // Un-ticked, it is simply one to get again.
    const undone = now.map((i) => (i.name === 'Bananas' ? { ...i, completed: false, completedAt: null } : i));
    expect(tripProgress(storeItems(undone, tripStart(undone, NOW)))).toEqual({ done: 0, total: 3 });
  });

  it('a repeat buy shows once: the fresh one, whatever the case or plural of the old one', () => {
    const shown = storeItems(list, tripStart(list, NOW));
    const produce = leftFirst(groupWithAisles(shown, new Map())).open.find((g) => g.title === CATEGORIES.PRODUCE)!;
    expect(produce.items.map((i) => i.name).sort()).toEqual(['Avocado', 'Bananas']);
  });

  it('30 of 39 in cart becomes what this trip holds', () => {
    // 30 ticked off on earlier trips, 9 to get; then 3 of the 9 ticked off now.
    const old = Array.from({ length: 30 }, (_, n) => boughtAgo(`Old ${n}`, (n + 2) * DAY));
    const left = Array.from({ length: 9 }, (_, n) => item(`New ${n}`));
    expect(tripProgress([...old, ...left])).toEqual({ done: 30, total: 39 });
    const shopping = [...old, ...left.map((i, n) => (n < 3 ? { ...i, completed: true, completedAt: NOW - (10 - n) * MIN } : i))];
    expect(tripProgress(storeItems(shopping, tripStart(shopping, NOW)))).toEqual({ done: 3, total: 9 });
  });
});
