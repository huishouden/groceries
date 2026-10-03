import { describe, expect, it } from 'vitest';
import { googleTaskItem, googleTaskItemId, toTasksSettings } from '../../src/data/googleTasks';

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
