import type { Firestore } from 'firebase/firestore';
import { localizeAgenda, syncAgenda } from '@huishouden/pwa-kit/agenda';
import { localizeTodos, syncTodos } from '@huishouden/pwa-kit/todos';
import { APP, agendaItems, todoItems } from './publish';
import type { PlannedMeal } from './mealPlan';
import type { ListItem, ShoppingList } from './model';

type PublishedStorage = NonNullable<Parameters<typeof syncAgenda>[4]['published']>;

export interface PublishOptions {
  /** A helper or kid: only open items are read and written. */
  restricted?: boolean;
  now?: number;
  /** Where this device notes what it last published (default localStorage; null reads every time). */
  published?: PublishedStorage | null;
}

const opts = ({ restricted = false, now, published }: PublishOptions) => ({ restricted, ...(now === undefined ? {} : { now }), ...(published === undefined ? {} : { published }) });

/** The planned dinners on the household agenda: one query of what Groceries published (none when this device already published the same). */
export async function publishAgenda(db: Firestore, householdId: string, by: string, plan: PlannedMeal[], o: PublishOptions = {}) {
  const items = await localizeAgenda(() => agendaItems(plan));
  return syncAgenda(db, householdId, APP, items, { by, ...opts(o) });
}

/** The one summary line on the household to-do list: one query, as `publishAgenda`. */
export async function publishTodos(db: Firestore, householdId: string, by: string, lists: ShoppingList[], items: ListItem[], o: PublishOptions = {}) {
  const todos = await localizeTodos(() => todoItems(lists, items));
  return syncTodos(db, householdId, APP, todos, { by, ...opts(o) });
}
