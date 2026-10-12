import { describe, expect, it } from 'vitest';
import { bringInTasks, googleTaskItem, googleTaskItemId, toTasksSettings } from '../../src/data/googleTasks';
import type { NewItem } from '../../src/data/store';

const task = { id: 'dGFzay1lZ2dz', listId: 'g2', title: 'Oat milk', notes: 'The barista one', due: '2031-05-16', updated: 0, completed: false };

describe('Google Tasks settings', () => {
  it('reads links and handled ids defensively', () => {
    expect(
      toTasksSettings({
        googleTasks: [
          { googleListId: 'g1', title: 'My Tasks', listId: 'chores', mode: 'suggest' },
          { googleListId: 'g2', title: 'Groceries', listId: 'groceries', mode: 'add' },
          { googleListId: '', listId: 'x' },
          { googleListId: 'g3', title: 'Odd', listId: 'chores', mode: 'shout' },
          'nonsense',
        ],
        handled: ['a', 7, 'b'],
      }),
    ).toEqual({
      googleTasks: [
        { googleListId: 'g1', title: 'My Tasks', listId: 'chores', mode: 'suggest' },
        { googleListId: 'g2', title: 'Groceries', listId: 'groceries', mode: 'add' },
        { googleListId: 'g3', title: 'Odd', listId: 'chores', mode: 'suggest' },
      ],
      handled: ['a', 'b'],
    });
    expect(toTasksSettings(undefined)).toEqual({ googleTasks: [], handled: [] });
  });
});

describe('a Google task on a list', () => {
  it('keeps its title and notes, under a fixed id; a shopping item has no due day', () => {
    expect(googleTaskItem(task, { listId: 'groceries' }, 'grocery', 'Alex')).toEqual({
      id: 'gt-dGFzay1lZ2dz',
      listId: 'groceries',
      listIcon: 'grocery',
      name: 'Oat milk',
      notes: 'The barista one',
      addedBy: 'Alex',
      googleTaskId: 'dGFzay1lZ2dz',
    });
    expect(googleTaskItemId('a/b c')).toBe('gt-a_b_c');
  });
});

describe('bringInTasks', () => {
  const task = (id: string, listId: string, title: string) => ({ id, listId, title, notes: '', updated: 0, completed: false });
  it("adds each task to the list its Google list feeds, skips one whose list isn't here, and marks them all taken in", async () => {
    const added: NewItem[] = [];
    const handled: string[][] = [];
    const target = { addItem: (i: NewItem) => (added.push(i), i.id ?? null), markHandled: async (ids: string[]) => void handled.push(ids) };
    const links = [
      { googleListId: 'g-shop', title: 'Shopping', listId: 'groceries', mode: 'add' as const },
      { googleListId: 'g-todo', title: 'To do', listId: 'chores-elsewhere', mode: 'add' as const },
    ];
    await bringInTasks(target, links, [{ id: 'groceries', icon: 'grocery' }], [task('t1', 'g-shop', 'Eggs'), task('t2', 'g-todo', 'Mow'), task('t3', 'g-other', 'Call')], { addedBy: 'Sam', by: 'sam@example.com' });
    expect(added.map((i) => [i.id, i.listId, i.name, i.addedBy, i.by])).toEqual([['gt-t1', 'groceries', 'Eggs', 'Sam', 'sam@example.com']]);
    expect(handled).toEqual([['t1', 't2', 't3']]);
  });
});
