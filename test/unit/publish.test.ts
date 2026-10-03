import { describe, expect, it } from 'vitest';
import { allDayStart } from '@huishouden/pwa-kit/agenda';
import { todoDoc } from '@huishouden/pwa-kit/todos';
import { APP, agendaItems, todoItems } from '../../src/data/publish';
import { URGENCY, type ListItem, type ShoppingList } from '../../src/data/model';
import type { PlannedMeal } from '../../src/data/mealPlan';

const planned = (day: PlannedMeal['day'], type: PlannedMeal['type'], name: string): PlannedMeal => ({
  day,
  type,
  name,
  meal: {} as PlannedMeal['meal'],
  by: 'alex@example.com',
  updatedAt: 0,
});

describe('agendaItems', () => {
  it('publishes planned dinners as all-day entries linking to Meals, and no other meals', () => {
    const all = agendaItems([planned('2031-01-07', 'dinner', 'Mushroom rice bowl'), planned('2031-01-07', 'lunch', 'Egg sandwich')]);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ title: 'Dinner: Mushroom rice bowl', allDay: true, start: allDayStart('2031-01-07'), kind: 'other' });
    expect(all[0].url).toMatch(/\/groceries\/\?mode=meals$/);
  });

  it('is published under Groceries, apart from Tasks’ dated to-dos', () => {
    expect(APP).toBe('groceries');
  });
});

const list = (id: string, name: string): ShoppingList => ({ id, name, description: '', icon: 'grocery', color: '#2d6a4f', sortOrder: 0, createdAt: 0 });
const item = (id: string, listId: string, createdAt: number, extra: Partial<ListItem> = {}): ListItem => ({
  id,
  listId,
  name: `Item ${id}`,
  category: 'Other',
  quantity: '',
  notes: '',
  addedBy: 'Alex',
  by: 'alex@example.com',
  completed: false,
  urgency: URGENCY.NORMAL,
  createdAt,
  updatedAt: createdAt,
  completedAt: null,
  ...extra,
});

describe('todoItems', () => {
  const lists = [list('weekly', 'Weekly shop'), list('tools', 'Hardware'), list('bulk', 'Bulk run')];

  it('publishes nothing when everything is bought', () => {
    expect(todoItems(lists, [])).toEqual([]);
    expect(todoItems(lists, [item('a', 'weekly', 5, { completed: true, completedAt: 9 })])).toEqual([]);
  });

  it('is one summary line counting the open items, from the oldest, linking to Groceries', () => {
    const all = todoItems(lists, [item('a', 'weekly', 300), item('b', 'weekly', 100), item('c', 'weekly', 50, { completed: true, completedAt: 400 })]);
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual({
      ref: 'list',
      status: 'info',
      title: 'Groceries: 2 things on the list',
      createdAt: 100,
      url: 'https://huishouden-piekstra.web.app/groceries/',
      private: false,
    });
    expect(all[0]).not.toHaveProperty('done');
    expect(all[0]).not.toHaveProperty('cancel');
  });

  it('says "1 thing" for one', () => {
    expect(todoItems(lists, [item('a', 'tools', 7)])[0].title).toBe('Groceries: 1 thing on the list');
  });

  it('counts only items on Groceries’ own lists (not Tasks’ to-dos)', () => {
    const all = todoItems(lists, [item('a', 'weekly', 10), item('t', 'chores-list', 1)]);
    expect(all[0].title).toBe('Groceries: 1 thing on the list');
    expect(all[0].createdAt).toBe(10);
  });

  it('names what is needed today and the busiest lists', () => {
    const all = todoItems(lists, [
      item('a', 'weekly', 1, { urgency: URGENCY.URGENT }),
      item('b', 'weekly', 2),
      item('c', 'weekly', 3, { urgency: URGENCY.URGENT }),
      item('d', 'tools', 4),
      item('e', 'bulk', 5, { urgency: URGENCY.URGENT, completed: true, completedAt: 6 }),
    ]);
    expect(all[0].detail).toBe('Need today: 2 · Weekly shop 3, Hardware 1');
  });

  it('leaves the detail out when it would say nothing (one list, nothing urgent)', () => {
    expect(todoItems(lists, [item('a', 'weekly', 1)])[0]).not.toHaveProperty('detail');
    expect(todoItems(lists, [item('a', 'weekly', 1, { urgency: URGENCY.URGENT })])[0].detail).toBe('Need today: 1');
  });

  it('is a document the kit and rules accept', () => {
    const [line] = todoItems(lists, [item('a', 'weekly', 1)]);
    expect(todoDoc(APP, line, 'alex@example.com', 1000)).toMatchObject({ app: 'groceries', ref: 'list', status: 'info', private: false });
  });
});
