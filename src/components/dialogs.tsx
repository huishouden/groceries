import { ROLE_LABELS, can, householdRole, type Role } from '@huishouden/pwa-kit/roles';
import { RoleNote, RoleSelect } from '@huishouden/pwa-kit/react/roles';
import { useState } from 'react';
import { Download, Search, Send, Trash2, UserPlus, Zap } from 'lucide-react';
import { ALL_CATEGORIES, URGENCY, LIST_COLORS, SHOPPING_ICONS, moveInOrder, type Category, type Household, type ListIcon, type ListItem, type ShoppingList, type Urgency } from '../data/model';
import { THEME_LABELS, THEME_MODES, useTheme } from '@huishouden/pwa-kit/react/theme';
import { friendlyError, type FriendlyError } from '../lib/errors';
import { ErrorNotice } from './ErrorNotice';
import { Dialog, ListIconBadge, ghostButton, inputClass, primaryButton } from './ui';
import { SortableRows } from './SortableRows';
import { storeSearchLinks } from '../data/chains';

/** "Find it at" the household's stores: each store's own search, or a web search, with the item filled in. */
function FindAtStores({ storeNames, itemName }: { storeNames: string[]; itemName: string }) {
  const links = storeSearchLinks(storeNames, itemName).slice(0, 6);
  if (links.length === 0) return null;
  return (
    <div className="grid gap-1.5" role="group" aria-label="Find it at a store">
      <span className="text-sm text-muted">Find it at</span>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            aria-label={l.storeSite ? `Find ${itemName.trim()} at ${l.store}` : `Search the web for ${itemName.trim()} at ${l.store}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 text-sm text-link hover:border-forest-500"
          >
            <Search size={14} /> {l.store}
          </a>
        ))}
      </div>
    </div>
  );
}

export function EditItemDialog({
  item,
  lists,
  onSave,
  onDelete,
  onClose,
  storeNames = [],
}: {
  item: ListItem;
  /** The lists it can move to: Groceries' own. */
  lists: ShoppingList[];
  /** The household's stores, the one being shopped first: each offers its own search for the item. */
  storeNames?: string[];
  onSave: (changes: Partial<ListItem>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity);
  const [notes, setNotes] = useState(item.notes);
  const [category, setCategory] = useState<Category>(item.category);
  const [urgency, setUrgency] = useState<Urgency>(item.urgency);
  const [listId, setListId] = useState(item.listId);
  const quick = 'inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-forest-500';
  const urgent = urgency === URGENCY.URGENT;

  return (
    <Dialog title="Edit item" onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave({ name: name.trim(), quantity: quantity.trim() || '1', notes: notes.trim(), category, urgency, listId });
          onClose();
        }}
      >
        <label className="text-sm text-muted">
          Item
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-muted">
            Quantity
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm text-muted">
            Section
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={`${inputClass} mt-1`}>
              {(ALL_CATEGORIES.includes(category) ? ALL_CATEGORIES : [category, ...ALL_CATEGORIES]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-sm text-muted">
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Brand, size, organic…" className={`${inputClass} mt-1`} />
        </label>
        <FindAtStores storeNames={storeNames} itemName={name} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setUrgency(urgent ? URGENCY.NORMAL : URGENCY.URGENT)}
            aria-pressed={urgent}
            className={`${quick} ${urgent ? 'border-terracotta bg-attention-tint font-semibold text-attention' : ''}`}
          >
            <Zap size={16} /> Need today
          </button>
        </div>
        {lists.length > 1 && (
          <label className="text-sm text-muted">
            List
            <select value={listId} onChange={(e) => setListId(e.target.value)} className={`${inputClass} mt-1`}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="text-sm text-muted">Added by {item.addedBy || 'someone'}</p>
        <div className="mt-2 flex justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className={`${ghostButton} text-red-600 dark:text-red-400`}
          >
            <Trash2 size={18} /> Delete
          </button>
          <button type="submit" className={primaryButton}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function NewListDialog({ onCreate, onClose }: { onCreate: (name: string, icon: ListIcon, color: string) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<ListIcon>('grocery');
  const [color, setColor] = useState(LIST_COLORS[0]);
  return (
    <Dialog title="New list" onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreate(name, icon, color);
          onClose();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Target, Home Depot, Farmers market…" className={inputClass} autoFocus />
        <div>
          <p className="mb-2 text-sm text-muted">Icon</p>
          <div className="flex flex-wrap gap-2">
            {SHOPPING_ICONS.map((i) => (
              <button
                type="button"
                key={i}
                onClick={() => setIcon(i)}
                className={`rounded-2xl p-1 ${icon === i ? 'ring-2 ring-forest-500' : ''}`}
                aria-label={i}
                aria-pressed={icon === i}
              >
                <ListIconBadge icon={i} color={color} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-muted">Color</p>
          <div className="flex flex-wrap gap-2">
            {LIST_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-9 w-9 rounded-full ${color === c ? 'ring-2 ring-forest-500 ring-offset-2 dark:ring-offset-forest-800' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>
        <button type="submit" disabled={!name.trim()} className={primaryButton}>
          Create list
        </button>
      </form>
    </Dialog>
  );
}

export function inviteMessage(email: string, householdName: string, url: string): string {
  return `I added you to "${householdName}" on Huishouden Groceries, our shared shopping lists.\n\nOpen ${url} and sign in with Google as ${email}. Then use Chrome's menu, "Install app" (or Share, "Add to Home Screen" on iPhone) to keep it on your home screen.`;
}

/** Opens the share sheet (text, WhatsApp, email…) or, where there is none, a prefilled email. */
async function sendInvite(email: string, householdName: string): Promise<void> {
  const url = window.location.origin;
  const text = inviteMessage(email, householdName, url);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Join our household on Huishouden Groceries', text });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Join our household on Huishouden Groceries')}&body=${encodeURIComponent(text)}`;
}

export function SettingsDialog({
  household,
  myEmail,
  addedAs,
  setAddedAs,
  install,
  googleTasks,
  onAddMember,
  onRemoveMember,
  onSetRole,
  onClose,
}: {
  household: Household;
  myEmail: string;
  addedAs: string;
  setAddedAs: (name: string) => void;
  install: { canInstall: boolean; installed: boolean; install: () => Promise<void> };
  /** Google Tasks into lists (GoogleTasksSettings). */
  googleTasks?: React.ReactNode;
  onAddMember: (email: string, role: Role) => Promise<void>;
  onRemoveMember: (email: string) => Promise<void>;
  onSetRole: (email: string, role: Role) => Promise<void>;
  onClose: () => void;
}) {
  const { mode, setMode } = useTheme();
  const [invite, setInvite] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const myRole = householdRole(household, myEmail);
  const admin = can(myRole, 'manage-people');
  const [error, setError] = useState<FriendlyError | null>(null);
  const validInvite = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.trim());
  return (
    <Dialog title="Settings" onClose={onClose}>
      <div className="grid gap-6">
        <section>
          <h3 className="mb-1 font-semibold">{household.name}</h3>
          <p className="mb-3 text-sm text-muted">
            What each person can do depends on their role, in every Huishouden app. Add someone by the Google address they sign in
            with, then send them the link.
          </p>
          <ul className="mb-3 grid gap-1.5">
            {household.members.map((m) => {
              const joined = m === myEmail || (household.joined ?? []).includes(m);
              return (
                <li key={m} className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {m}
                      {m === myEmail && <span className="ml-1 text-muted">(you)</span>}
                    </span>
                    <span className={`text-xs ${joined ? 'text-positive' : 'text-attention'}`}>
                      {joined ? 'Joined' : 'Invited, not signed in yet'}
                    </span>
                    {!(admin && m !== myEmail) && <span className="text-xs text-muted"> · {ROLE_LABELS[householdRole(household, m) ?? 'member']}</span>}
                  </span>
                  {admin && m !== myEmail && (
                    <RoleSelect
                      value={householdRole(household, m) ?? 'member'}
                      label={`Role for ${m}`}
                      onChange={(next) => void onSetRole(m, next).catch((err: unknown) => setError(friendlyError(err, 'save')))}
                    />
                  )}
                  {!joined && (
                    <button onClick={() => void sendInvite(m, household.name)} className={`${ghostButton} text-sm`} aria-label={`Send invite to ${m}`}>
                      <Send size={16} /> Send invite
                    </button>
                  )}
                  {admin && m !== myEmail && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${m} from the household?`)) void onRemoveMember(m).catch((err: unknown) => setError(friendlyError(err, 'save')));
                      }}
                      className="rounded-lg p-1.5 text-stone-400 hover:text-red-600 dark:hover:text-red-300"
                      aria-label={`Remove ${m}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {!admin && <RoleNote action="manage-people" />}
          {admin && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validInvite) return;
              setError(null);
              const email = invite.trim().toLowerCase();
              onAddMember(email, inviteRole)
                .then(() => {
                  setInvite('');
                  setInviteRole('member');
                })
                .catch((err: unknown) => setError(friendlyError(err, 'save')));
            }}
          >
            <input type="email" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Their Google account email" className={inputClass} aria-label="Their Google account email" />
            <RoleSelect value={inviteRole} label="Their role" onChange={setInviteRole} />
            <button type="submit" disabled={!validInvite} className={primaryButton} aria-label="Add member">
              <UserPlus size={18} />
            </button>
          </form>
          )}
          {error && (
            <div className="mt-2">
              <ErrorNotice error={error} />
            </div>
          )}
        </section>

        <section>
          <label className="text-sm font-semibold">
            Items added on this device are labelled
            <input value={addedAs} onChange={(e) => setAddedAs(e.target.value)} className={`${inputClass} mt-1 font-normal`} />
          </label>
          <p className="mt-1 text-sm text-muted">Use "Kitchen" on the shared tablet so you can tell who added what.</p>
        </section>

        {googleTasks}

        <section>
          <p id="theme-label" className="mb-2 text-sm font-semibold">Theme</p>
          <p className="mb-2 text-sm text-muted">For every Huishouden app on this device. Automatic follows the device.</p>
          <div className="flex gap-2" role="group" aria-labelledby="theme-label">
            {THEME_MODES.map((t) => (
              <button
                key={t}
                onClick={() => setMode(t)}
                aria-pressed={mode === t}
                className={`flex-1 rounded-xl border px-3 py-2 ${mode === t ? 'border-forest-600 bg-forest-50 font-semibold dark:bg-forest-700' : 'border-stone-200 dark:border-forest-600'}`}
              >
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>
        </section>

        {!install.installed && (
          <section>
            <p className="mb-2 text-sm font-semibold">Install</p>
            {install.canInstall ? (
              <button onClick={() => void install.install()} className={primaryButton}>
                <Download size={18} /> Install Groceries on this device
              </button>
            ) : (
              <p className="text-sm text-muted">In Chrome, open the ⋮ menu and choose "Add to Home screen" or "Install app". On iPhone, use Share, then "Add to Home Screen".</p>
            )}
          </section>
        )}

      </div>
    </Dialog>
  );
}

export function ReorderListsDialog({ lists, onReorder, onClose }: { lists: ShoppingList[]; onReorder: (ids: string[]) => void; onClose: () => void }) {
  const ids = lists.map((l) => l.id);
  return (
    <Dialog title="Reorder lists" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Drag by the grip. Everyone in the household sees the new order.</p>
      <SortableRows
        ids={ids}
        label={(id) => lists.find((l) => l.id === id)?.name ?? id}
        onMove={(from, to) => onReorder(moveInOrder(ids, from, to))}
        renderRow={(id) => {
          const list = lists.find((l) => l.id === id)!;
          return (
            <>
              <ListIconBadge icon={list.icon} color={list.color} size="sm" />
              <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{list.name}</span>
            </>
          );
        }}
      />
      <button onClick={onClose} className={`${primaryButton} mt-4 w-full`}>
        Done
      </button>
    </Dialog>
  );
}
