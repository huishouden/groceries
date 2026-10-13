import type { ListItem } from './model';

const HOUR = 60 * 60 * 1000;

/**
 * Two check-offs this far apart belong to different trips. A shopper ticks something every few
 * minutes; three hours of nothing means the trip is over (the same span as a shopping session's
 * aisle prompts in App.tsx).
 */
export const TRIP_GAP_MS = 3 * HOUR;

/** No trip reaches back further than this, however steadily things were ticked off all day. */
export const TRIP_MAX_MS = 12 * HOUR;

/**
 * When the shopping trip running now began: the earliest check-off in the unbroken run of
 * check-offs that reaches up to now with no gap of `TRIP_GAP_MS` or more (counting the gap from
 * the latest one to now), and no older than `TRIP_MAX_MS`. Null when nothing was ticked off in the
 * last `TRIP_GAP_MS`: no trip is running.
 *
 * Worked out from the items themselves, not from this device: two people shopping at once tick
 * into the same run, so both see the same trip, and a phone that joins halfway sees it too. A long
 * shop stays one trip for as long as something is ticked off every few hours. Clock differences
 * between devices are minutes against a gap of hours; a check-off stamped slightly in the future
 * counts as now. Items done without a time (older data) never belong to a trip.
 */
export function tripStart(items: Pick<ListItem, 'completed' | 'completedAt'>[], now: number): number | null {
  const times = items
    .flatMap((i) => (i.completed && typeof i.completedAt === 'number' && Number.isFinite(i.completedAt) ? [i.completedAt] : []))
    .sort((a, b) => b - a);
  let start: number | null = null;
  let later = now;
  for (const t of times) {
    if (later - t >= TRIP_GAP_MS || now - t > TRIP_MAX_MS) break;
    start = t;
    later = Math.min(later, t);
  }
  return start;
}

/** Whether an item is ticked off during the trip that began at `start`. */
export function boughtThisTrip(item: Pick<ListItem, 'completed' | 'completedAt'>, start: number | null): boolean {
  return start !== null && item.completed && typeof item.completedAt === 'number' && item.completedAt >= start;
}

/**
 * What Store mode shows: everything still to get, and what was ticked off this trip (so a mistake
 * can be un-ticked). Things bought on earlier trips stay on the list (Lists shows them until Clear
 * bought; Meals plans from them) but are out of the way here, so a fresh "Bananas" never sits next
 * to last week's ticked-off "bananas".
 */
export function storeItems<T extends Pick<ListItem, 'completed' | 'completedAt'>>(items: T[], start: number | null): T[] {
  return items.filter((i) => !i.completed || boughtThisTrip(i, start));
}

/** The "N of M in cart" count: of what Store mode shows, how much is ticked off. */
export function tripProgress(shown: Pick<ListItem, 'completed'>[]): { done: number; total: number } {
  return { done: shown.filter((i) => i.completed).length, total: shown.length };
}
