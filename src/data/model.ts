import { can, type Role } from '@huishouden/pwa-kit/roles';
export const CATEGORIES = {
  PRODUCE: 'Produce & Greens',
  DAIRY_EGGS: 'Dairy & Eggs',
  BAKERY: 'Bakery & Bread',
  MEAT_SEAFOOD: 'Meat & Seafood',
  PANTRY: 'Pantry & Dry Goods',
  FROZEN: 'Frozen Foods',
  BEVERAGES: 'Beverages & Coffee',
  SNACKS: 'Snacks & Sweets',
  HOUSEHOLD: 'Household & Cleaning',
  PERSONAL_CARE: 'Personal Care',
  HARDWARE_HOME: 'Hardware & Tools',
  CHORES: 'Chores & Tasks',
  OTHER: 'Other',
} as const;

export type Category = (typeof CATEGORIES)[keyof typeof CATEGORIES];

/** The sections an item can be filed under. Chores & Tasks is Huishouden Tasks' own. */
export const ALL_CATEGORIES: Category[] = Object.values(CATEGORIES).filter((c) => c !== CATEGORIES.CHORES);

/** The order a typical store is walked in. */
export const AISLE_ORDER: Category[] = [
  CATEGORIES.PRODUCE,
  CATEGORIES.BAKERY,
  CATEGORIES.MEAT_SEAFOOD,
  CATEGORIES.DAIRY_EGGS,
  CATEGORIES.PANTRY,
  CATEGORIES.SNACKS,
  CATEGORIES.BEVERAGES,
  CATEGORIES.FROZEN,
  CATEGORIES.HOUSEHOLD,
  CATEGORIES.PERSONAL_CARE,
  CATEGORIES.HARDWARE_HOME,
  CATEGORIES.CHORES,
  CATEGORIES.OTHER,
];

export const URGENCY = {
  NORMAL: 'Standard',
  URGENT: 'Need Today',
  WHENEVER: 'Whenever',
} as const;

export type Urgency = (typeof URGENCY)[keyof typeof URGENCY];

export const ALL_URGENCIES: Urgency[] = [URGENCY.NORMAL, URGENCY.URGENT, URGENCY.WHENEVER];

export type ListIcon = 'grocery' | 'pantry' | 'bulk' | 'hardware' | 'notes' | 'chores';

/**
 * Lists of to-dos and errands rather than things to buy. They belong to Huishouden Tasks, which
 * reads the same household lists and shows only these; Groceries shows every other list. Keep this
 * the same in both apps (huishouden/tasks src/data/model.ts).
 */
export function isTaskList(icon: ListIcon | undefined): boolean {
  return icon === 'chores' || icon === 'notes';
}

/** The kinds of list Groceries makes. */
export const SHOPPING_ICONS: ListIcon[] = ['grocery', 'pantry', 'bulk', 'hardware'];

export interface ShoppingList {
  id: string;
  name: string;
  description: string;
  icon: ListIcon;
  color: string;
  sortOrder: number;
  createdAt: number;
}

export interface ListItem {
  id: string;
  listId: string;
  name: string;
  category: Category;
  quantity: string;
  notes: string;
  addedBy: string;
  /** Email of whoever added it: helpers and kids change and delete only their own (the rules check it). */
  by?: string;
  completed: boolean;
  urgency: Urgency;
  /** Manual order within the list; lower comes first. Older items without one use createdAt. */
  position?: number;
  // Dates, places, links and steps are Huishouden Tasks' (to-dos share this document shape);
  // Groceries never writes them and leaves them as they are.
  /** When it is due or scheduled, in ms since the epoch. With `allDay`, only the date matters. */
  dueAt?: number | null;
  allDay?: boolean;
  /** A deadline ("by 6 PM", typed as "before 6") rather than an appointment ("at 6 PM"). */
  dueBy?: boolean;
  location?: string;
  /** The place chosen with Find nearby, so the app can mention the errand when you are near it. */
  place?: ItemPlace | null;
  /** A link to open from the item, such as the appointment's Google Calendar event. */
  link?: string;
  /** Steps ticked off one at a time; the item completes when the last one is done. */
  subtasks?: Subtask[];
  /** Brought in from this Google task (@huishouden/pwa-kit/google-tasks). */
  googleTaskId?: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface ItemPlace {
  name: string;
  lat: number;
  lon: number;
  /** Business hours as OpenStreetMap writes them, when the map has them. */
  hours?: string;
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Staple {
  id: string;
  displayName: string;
  category: Category;
  defaultQuantity: string;
  timesAdded: number;
  timesCompleted: number;
  lastAddedAt: number;
}

export interface Household {
  id: string;
  name: string;
  members: string[];
  /** Members who have signed in at least once; the rest are invited but not yet seen. */
  joined?: string[];
  /** Roles written out (`@huishouden/pwa-kit/roles`); anyone missing is a member, the creator an admin. */
  roles?: Record<string, Role>;
  createdAt: number;
}

/**
 * The lists a new household starts with, in Groceries and in Tasks alike, so whichever app creates
 * the household sets up both. Restoring defaults restores only this app's kind.
 */
export const DEFAULT_LISTS: Omit<ShoppingList, 'createdAt'>[] = [
  { id: 'groceries', name: 'Groceries', description: 'Weekly supermarket and fresh market run', icon: 'grocery', color: '#2d6a4f', sortOrder: 0 },
  { id: 'pantry', name: 'Pantry Restock', description: 'Dry goods, spices and kitchen essentials', icon: 'pantry', color: '#b08d57', sortOrder: 1 },
  { id: 'costco', name: 'Costco & Bulk', description: 'Paper goods, snacks and bulk supplies', icon: 'bulk', color: '#5b7a99', sortOrder: 2 },
  { id: 'hardware', name: 'Hardware & Home', description: 'Repairs, tools, filters and garden', icon: 'hardware', color: '#a8735a', sortOrder: 3 },
  { id: 'chores', name: 'Chores & Notes', description: 'Reminders, repairs and weekend to-dos', icon: 'chores', color: '#8a6f9e', sortOrder: 4 },
];

/** The suite's muted categorical set (DESIGN.md), in its order. */
export const LIST_COLORS = ['#2d6a4f', '#c86d51', '#b08d57', '#5b7a99', '#8a6f9e', '#6f8f72', '#a8735a', '#78716c'];

/** Firestore document IDs cannot contain "/", and staples are keyed by normalized name. */
export function stapleKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\//g, '-');
}

export function groupByAisle(items: ListItem[]): [Category, ListItem[]][] {
  const groups = new Map<Category, ListItem[]>();
  for (const item of items) {
    const key = AISLE_ORDER.includes(item.category) ? item.category : CATEGORIES.OTHER;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return AISLE_ORDER.filter((c) => groups.has(c)).map((c) => [c, sortItems(groups.get(c)!)]);
}

export function itemPosition(item: ListItem): number {
  return item.position ?? item.createdAt;
}

/** The household's own order, set by dragging; new items land at the bottom, urgent ones at the top. */
export function sortItems(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => itemPosition(a) - itemPosition(b));
}

/** Position that puts an item between its new neighbours, or null when they are too close to split. */
export function positionBetween(before: ListItem | undefined, after: ListItem | undefined): number | null {
  if (before && after) {
    const mid = (itemPosition(before) + itemPosition(after)) / 2;
    return mid > itemPosition(before) && mid < itemPosition(after) ? mid : null;
  }
  if (before) return itemPosition(before) + 1000;
  if (after) return itemPosition(after) - 1000;
  return Date.now();
}

/** The list after moving the item at `from` to index `to`. */
export function moveInOrder<T>(ordered: T[], from: number, to: number): T[] {
  const next = ordered.filter((_, i) => i !== from);
  next.splice(to, 0, ordered[from]);
  return next;
}

/**
 * The staples Groceries offers: not chores. Groceries learns only from its own lists, but staples
 * learned when Tasks and Groceries were one app include chores; those are filed under Chores &
 * Tasks or named like an item on one of Tasks' lists, and stay out of the shelf and the add bar.
 */
export function shoppingStaples(staples: Staple[], taskItems: Pick<ListItem, 'name'>[]): Staple[] {
  const chores = new Set(taskItems.map((i) => stapleKey(i.name)));
  return staples.filter((s) => s.category !== CATEGORIES.CHORES && !chores.has(s.id) && !chores.has(stapleKey(s.displayName ?? '')));
}

export function matchSuggestions(staples: Staple[], query: string, limit = 6): Staple[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return staples
    .filter((s) => s.displayName.toLowerCase().includes(q))
    .sort((a, b) => {
      const aPrefix = a.displayName.toLowerCase().startsWith(q) ? 0 : 1;
      const bPrefix = b.displayName.toLowerCase().startsWith(q) ? 0 : 1;
      return aPrefix - bPrefix || b.timesAdded - a.timesAdded;
    })
    .slice(0, limit);
}

export function formatListForSharing(listName: string, items: ListItem[]): string {
  const active = items.filter((i) => !i.completed);
  const done = items.filter((i) => i.completed);
  const lines = [`${listName}`, ''];
  if (active.length === 0) {
    lines.push('Everything on this list is done.');
  } else {
    for (const [category, group] of groupByAisle(active)) {
      lines.push(`${category}:`);
      for (const item of group) {
        let line = `- ${item.name}`;
        if (item.quantity && item.quantity !== '1') line += ` (${item.quantity})`;
        if (item.notes) line += `, ${item.notes}`;
        if (item.urgency === URGENCY.URGENT) line += ' [need today]';
        lines.push(line);
      }
      lines.push('');
    }
  }
  if (done.length > 0) {
    lines.push(`Already done (${done.length}): ${done.map((i) => i.name).join(', ')}`);
  }
  return lines.join('\n').trimEnd();
}

export function firstName(displayName: string | null | undefined, email: string): string {
  const fromName = displayName?.trim().split(/\s+/)[0];
  return fromName || email.split('@')[0];
}

/** The stored document for an item: every field but the id, which is the document's key. */
export function itemData(item: ListItem): Omit<ListItem, 'id'> {
  // Firestore rejects undefined field values, which an item built in code can carry.
  return Object.fromEntries(Object.entries(item).filter(([k, v]) => k !== 'id' && v !== undefined)) as Omit<ListItem, 'id'>;
}

/** What the undo bar says after items are removed. */
export function removedMessage(items: ListItem[], how: 'deleted' | 'cleared'): string {
  const n = items.length;
  if (how === 'cleared') return `Cleared ${n} done item${n === 1 ? '' : 's'}`;
  return n === 1 ? `Deleted "${items[0].name}"` : `Deleted ${n} items`;
}

/**
 * Whether someone may change or delete an item (ticking it off is open to everyone): admins and
 * members any, helpers and kids only those they added. Matches the household rules.
 */
export function mayChangeItem(item: Pick<ListItem, 'by'>, role: Role | null, email: string): boolean {
  return can(role, 'edit-others') || (!!role && !!item.by && item.by === email);
}
