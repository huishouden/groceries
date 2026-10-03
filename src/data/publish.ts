import type { AgendaInput } from '@huishouden/pwa-kit/agenda';
import type { TodoInput } from '@huishouden/pwa-kit/todos';
import { appLink } from '../lib/appLink';
import { dinnerAgenda, type PlannedMeal } from './mealPlan';
import { URGENCY, type ListItem, type ShoppingList } from './model';

// What Groceries shares with the rest of Huishouden: planned dinners on the household agenda (the
// portal's Calendar and Today), and one summary line on the household to-do list. Worked out from
// the data itself, so any device can publish it and it always matches. Dated to-dos and their
// reminders are Huishouden Tasks'.

export const APP = 'groceries';

/** Everything Groceries puts on the household agenda: the planned dinners. */
export function agendaItems(plan: PlannedMeal[]): AgendaInput[] {
  return plan.filter((p) => p.type === 'dinner').map((p) => dinnerAgenda(p));
}

/** How many lists the summary names, busiest first. */
const LISTS_NAMED = 3;

/**
 * Groceries' line on the household to-do list: how many things are still to buy on its own lists,
 * as one summary (`info`, no actions; a list of small things is not ticked off from elsewhere).
 * Nothing when everything is bought. `lists` are Groceries' lists (not Tasks'), `items` may include
 * others: only open items on those lists count.
 */
export function todoItems(lists: ShoppingList[], items: ListItem[]): TodoInput[] {
  const names = new Map(lists.map((l) => [l.id, l.name]));
  const open = items.filter((i) => !i.completed && names.has(i.listId));
  if (open.length === 0) return [];

  const perList = new Map<string, number>();
  for (const i of open) perList.set(i.listId, (perList.get(i.listId) ?? 0) + 1);
  const busiest = [...perList]
    .sort((a, b) => b[1] - a[1] || (names.get(a[0]) ?? '').localeCompare(names.get(b[0]) ?? ''))
    .slice(0, LISTS_NAMED)
    .map(([id, n]) => `${names.get(id)} ${n}`);
  const urgent = open.filter((i) => i.urgency === URGENCY.URGENT).length;
  const detail = [urgent > 0 ? `Need today: ${urgent}` : null, perList.size > 1 ? busiest.join(', ') : null].filter(Boolean).join(' · ');

  return [
    {
      ref: 'list',
      status: 'info',
      title: `Groceries: ${open.length} ${open.length === 1 ? 'thing' : 'things'} on the list`,
      ...(detail ? { detail } : {}),
      createdAt: Math.min(...open.map((i) => i.createdAt)),
      url: appLink(),
      private: false,
    },
  ];
}
