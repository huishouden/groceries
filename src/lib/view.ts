/**
 * Which view and list are on screen, from the address (`?mode=hub&list=pantry`) and what this device
 * last showed. One rule, in one place:
 *
 * - The view: `?mode=` when it names one; a link with `?list=` and no mode (an item from the
 *   household calendar or a reminder) opens Lists; otherwise the remembered view.
 * - The list: `?list=` when the household has it, or the person just chose it (a new list is
 *   missing until its snapshot arrives); a stale or foreign id (the sample's list after signing in,
 *   a deleted list from an old link) falls back to the remembered list, else the first.
 * - What the address names is remembered; a stale id never is. A bare or stale address is written
 *   in place (no history entry) so it names what is shown, and Back from the next view returns here.
 *   Before the lists load, the list is neither checked nor remembered.
 */
export type Mode = 'lists' | 'hub' | 'store' | 'meals';
export const MODES: readonly Mode[] = ['lists', 'hub', 'store', 'meals'];
export const isMode = (m: string | null | undefined): m is Mode => !!m && (MODES as readonly string[]).includes(m);

export interface ViewChoice {
  mode: Mode;
  list: string;
  /** Remember these for this device. */
  save: { mode?: Mode; list?: string };
  /** Write these into the address in place, or null when it already names what is shown. */
  address: { mode: Mode; list: string } | null;
}

export function resolveView(
  url: { mode: string | null; list: string | null },
  saved: { mode: Mode; list: string },
  ids: readonly string[] | null,
  chosenList: string | null = null,
): ViewChoice {
  const mode: Mode = isMode(url.mode) ? url.mode : url.list && !url.mode ? 'lists' : saved.mode;
  let list: string;
  let listNamed: boolean;
  if (!ids) {
    list = url.list ?? saved.list;
    listNamed = !!url.list;
  } else if (url.list && (ids.includes(url.list) || url.list === chosenList)) {
    list = url.list;
    listNamed = true;
  } else {
    list = ids.includes(saved.list) ? saved.list : (ids[0] ?? saved.list);
    // A household with no lists: nothing to name.
    listNamed = ids.length === 0;
  }
  const save: ViewChoice['save'] = {};
  if (isMode(url.mode) && url.mode !== saved.mode) save.mode = url.mode;
  if (ids && url.list && ids.includes(url.list) && url.list !== saved.list) save.list = url.list;
  const address = isMode(url.mode) && listNamed ? null : { mode, list };
  return { mode, list, save, address };
}
