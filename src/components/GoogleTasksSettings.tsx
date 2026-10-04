import { useState } from 'react';
import { ListTodo, Loader2 } from 'lucide-react';
import type { Auth } from 'firebase/auth';
import { googleTaskLists, googleTasksToken, type GoogleTaskList } from '@huishouden/pwa-kit/google-tasks';
import { googleAccessMessage } from '@huishouden/pwa-kit/feedback';
import { ghostButton, inputClass } from './ui';
import type { ShoppingList } from '../data/model';
import type { GoogleTasksLink } from '../data/googleTasks';

/**
 * "Google Tasks" in Settings: connect from a tap, then choose which Google list feeds which shopping
 * list; new tasks there are added straight away. A Google list that feeds a to-do list belongs to
 * Huishouden Tasks: it is named here, and its link is saved back as it was.
 */
export function GoogleTasksSettings({
  auth,
  lists,
  taskLists,
  links,
  onSave,
  onConnected,
}: {
  auth: Auth;
  /** Groceries' lists. */
  lists: ShoppingList[];
  /** Huishouden Tasks' lists, to name the links that are Tasks'. */
  taskLists: ShoppingList[];
  /** Every link in the household's settings, Tasks' included. */
  links: GoogleTasksLink[];
  onSave: (links: GoogleTasksLink[]) => Promise<void>;
  /** This device has a fresh token: look for new tasks now. */
  onConnected: () => void;
}) {
  const [googleLists, setGoogleLists] = useState<GoogleTaskList[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const token = await googleTasksToken(auth);
      setGoogleLists(await googleTaskLists(token));
      onConnected();
    } catch (e) {
      setError(googleAccessMessage(e, 'Google Tasks') ?? "Couldn't read your Google Tasks lists. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function choose(list: GoogleTaskList, listId: string) {
    const others = links.filter((l) => l.googleListId !== list.id);
    const target = lists.find((l) => l.id === listId);
    const next = target ? [...others, { googleListId: list.id, title: list.title, listId, mode: 'add' as const }] : others;
    onSave(next).catch(() => setError("Couldn't save. Try again."));
  }

  const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? 'a removed list';
  const tasksList = (l: GoogleTasksLink | undefined) => (l ? taskLists.find((t) => t.id === l.listId) : undefined);
  const mine = links.filter((l) => !tasksList(l));
  const what = (l: GoogleTasksLink) => `New tasks in ${l.title} go straight onto ${listName(l.listId)}.`;

  return (
    <section aria-label="Google Tasks" className="grid gap-2">
      <p className="text-sm font-semibold">Google Tasks</p>
      <p className="text-sm text-muted">
        Things you ask the Gemini app or Google Assistant to add to a list land in Google Tasks. Groceries can bring them onto a shopping list. It checks when it
        opens or comes back into view, for an hour after you connect on this device.
      </p>
      {mine.length > 0 && (
        <ul className="grid gap-1 text-sm text-ink-soft">
          {mine.map((l) => (
            <li key={l.googleListId}>{what(l)}</li>
          ))}
        </ul>
      )}
      {googleLists === null ? (
        <button type="button" onClick={() => void connect()} disabled={busy} className={`${ghostButton} justify-self-start border border-line`}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ListTodo size={18} />} {mine.length ? 'Connect again and check now' : 'Connect Google Tasks'}
        </button>
      ) : googleLists.length === 0 ? (
        <p className="text-sm text-muted">Your Google account has no task lists yet.</p>
      ) : (
        <div className="grid gap-2">
          {googleLists.map((g) => {
            const theirs = tasksList(links.find((l) => l.googleListId === g.id));
            return theirs ? (
              <p key={g.id} className="text-sm text-muted">
                {g.title}: goes to {theirs.name} in{' '}
                <a href="/tasks/" className="font-medium text-link underline underline-offset-2">
                  Tasks
                </a>
              </p>
            ) : (
              <label key={g.id} className="grid gap-1 text-sm text-muted">
                {g.title}
                <select
                  className={inputClass}
                  value={links.find((l) => l.googleListId === g.id)?.listId ?? ''}
                  onChange={(e) => choose(g, e.target.value)}
                  aria-label={`Bring ${g.title} into`}
                >
                  <option value="">Leave in Google Tasks</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      Add to {l.name}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </section>
  );
}
