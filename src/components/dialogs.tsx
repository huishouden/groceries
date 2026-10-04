import { can, householdRole, roleLabel, type Role } from '@huishouden/pwa-kit/roles';
import { RoleNote, RoleSelect } from '@huishouden/pwa-kit/react/roles';
import { useState } from 'react';
import { Download, Search, Send, Trash2, UserPlus, Zap } from 'lucide-react';
import { ALL_CATEGORIES, URGENCY, LIST_COLORS, SHOPPING_ICONS, categoryLabel, listName, moveInOrder, type Category, type Household, type ListIcon, type ListItem, type ShoppingList, type Urgency } from '../data/model';
import { friendlyError, type FriendlyError } from '../lib/errors';
import { ErrorNotice } from './ErrorNotice';
import { Dialog, ListIconBadge, ghostButton, inputClass, primaryButton } from './ui';
import { SortableRows } from './SortableRows';
import { storeSearchLinks } from '../data/chains';
import { t, useT } from '../i18n';

/** "Find it at" the household's stores: each store's own search, or a web search, with the item filled in. */
function FindAtStores({ storeNames, itemName }: { storeNames: string[]; itemName: string }) {
  const t = useT();
  const links = storeSearchLinks(storeNames, itemName).slice(0, 6);
  if (links.length === 0) return null;
  return (
    <div className="grid gap-1.5" role="group" aria-label={t('findAt.group')}>
      <span className="text-sm text-muted">{t('findAt.title')}</span>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            aria-label={l.storeSite ? t('findAt.label', { name: itemName.trim(), store: l.store }) : t('findAt.webLabel', { name: itemName.trim(), store: l.store })}
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
  const t = useT();
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity);
  const [notes, setNotes] = useState(item.notes);
  const [category, setCategory] = useState<Category>(item.category);
  const [urgency, setUrgency] = useState<Urgency>(item.urgency);
  const [listId, setListId] = useState(item.listId);
  const quick = 'inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-forest-500';
  const urgent = urgency === URGENCY.URGENT;

  return (
    <Dialog title={t('item.editTitle')} onClose={onClose}>
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
          {t('item.item')}
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-muted">
            {t('item.quantity')}
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm text-muted">
            {t('item.section')}
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={`${inputClass} mt-1`}>
              {(ALL_CATEGORIES.includes(category) ? ALL_CATEGORIES : [category, ...ALL_CATEGORIES]).map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-sm text-muted">
          {t('common.notes')}
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('item.notesPlaceholder')} className={`${inputClass} mt-1`} />
        </label>
        <FindAtStores storeNames={storeNames} itemName={name} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setUrgency(urgent ? URGENCY.NORMAL : URGENCY.URGENT)}
            aria-pressed={urgent}
            className={`${quick} ${urgent ? 'border-terracotta bg-attention-tint font-semibold text-attention' : ''}`}
          >
            <Zap size={16} /> {t('item.needToday')}
          </button>
        </div>
        {lists.length > 1 && (
          <label className="text-sm text-muted">
            {t('item.list')}
            <select value={listId} onChange={(e) => setListId(e.target.value)} className={`${inputClass} mt-1`}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {listName(l)}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="text-sm text-muted">{item.addedBy ? t('item.addedBy', { name: item.addedBy }) : t('item.addedBySomeone')}</p>
        <div className="mt-2 flex justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className={`${ghostButton} text-red-600 dark:text-red-400`}
          >
            <Trash2 size={18} /> {t('common.delete')}
          </button>
          <button type="submit" className={primaryButton}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function NewListDialog({ onCreate, onClose }: { onCreate: (name: string, icon: ListIcon, color: string) => void; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<ListIcon>('grocery');
  const [color, setColor] = useState(LIST_COLORS[0]);
  return (
    <Dialog title={t('lists.new')} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreate(name, icon, color);
          onClose();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('newList.placeholder')} className={inputClass} autoFocus aria-label={t('newList.name')} />
        <div>
          <p className="mb-2 text-sm text-muted">{t('newList.icon')}</p>
          <div className="flex flex-wrap gap-2">
            {SHOPPING_ICONS.map((i) => (
              <button
                type="button"
                key={i}
                onClick={() => setIcon(i)}
                className={`rounded-2xl p-1 ${icon === i ? 'ring-2 ring-forest-500' : ''}`}
                aria-label={t(ICON_KEYS[i])}
                aria-pressed={icon === i}
              >
                <ListIconBadge icon={i} color={color} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-muted">{t('newList.color')}</p>
          <div className="flex flex-wrap gap-2">
            {LIST_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-9 w-9 rounded-full ${color === c ? 'ring-2 ring-forest-500 ring-offset-2 dark:ring-offset-forest-800' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={t('newList.colorOption', { color: c })}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>
        <button type="submit" disabled={!name.trim()} className={primaryButton}>
          {t('newList.create')}
        </button>
      </form>
    </Dialog>
  );
}

const ICON_KEYS = { grocery: 'icon.grocery', pantry: 'icon.pantry', bulk: 'icon.bulk', hardware: 'icon.hardware', notes: 'icon.notes', chores: 'icon.chores' } as const satisfies Record<ListIcon, string>;

/** The invitation text, in the inviter's language (they choose who to send it to). */
export function inviteMessage(email: string, householdName: string, url: string): string {
  return t('invite.message', { household: householdName, url, email });
}

/** Opens the share sheet (text, WhatsApp, email…) or, where there is none, a prefilled email. */
async function sendInvite(email: string, householdName: string): Promise<void> {
  const url = window.location.origin;
  const text = inviteMessage(email, householdName, url);
  if (navigator.share) {
    try {
      await navigator.share({ title: t('invite.subject'), text });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(t('invite.subject'))}&body=${encodeURIComponent(text)}`;
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
  const t = useT();
  const [invite, setInvite] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const myRole = householdRole(household, myEmail);
  const admin = can(myRole, 'manage-people');
  const [error, setError] = useState<FriendlyError | null>(null);
  const validInvite = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.trim());
  return (
    <Dialog title={t('settings.title')} onClose={onClose}>
      <div className="grid gap-6">
        <section>
          <h3 className="mb-1 font-semibold" translate="no">{household.name}</h3>
          <p className="mb-3 text-sm text-muted">{t('settings.membersHint')}</p>
          <ul className="mb-3 grid gap-1.5">
            {household.members.map((m) => {
              const joined = m === myEmail || (household.joined ?? []).includes(m);
              return (
                <li key={m} className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      <span translate="no">{m}</span>
                      {m === myEmail && <span className="ml-1 text-muted">{t('settings.you')}</span>}
                    </span>
                    <span className={`text-xs ${joined ? 'text-positive' : 'text-attention'}`}>
                      {joined ? t('settings.joined') : t('settings.invited')}
                    </span>
                    {!(admin && m !== myEmail) && <span className="text-xs text-muted"> · {roleLabel(householdRole(household, m) ?? 'member')}</span>}
                  </span>
                  {admin && m !== myEmail && (
                    <RoleSelect
                      value={householdRole(household, m) ?? 'member'}
                      label={t('settings.roleFor', { email: m })}
                      onChange={(next) => void onSetRole(m, next).catch((err: unknown) => setError(friendlyError(err, 'save')))}
                    />
                  )}
                  {!joined && (
                    <button onClick={() => void sendInvite(m, household.name)} className={`${ghostButton} text-sm`} aria-label={t('settings.sendInviteTo', { email: m })}>
                      <Send size={16} /> {t('settings.sendInvite')}
                    </button>
                  )}
                  {admin && m !== myEmail && (
                    <button
                      onClick={() => {
                        if (confirm(t('settings.removeConfirm', { email: m }))) void onRemoveMember(m).catch((err: unknown) => setError(friendlyError(err, 'save')));
                      }}
                      className="rounded-lg p-1.5 text-stone-400 hover:text-red-600 dark:hover:text-red-300"
                      aria-label={t('settings.remove', { email: m })}
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
            <input type="email" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder={t('settings.inviteEmail')} className={inputClass} aria-label={t('settings.inviteEmail')} />
            <RoleSelect value={inviteRole} label={t('settings.theirRole')} onChange={setInviteRole} />
            <button type="submit" disabled={!validInvite} className={primaryButton} aria-label={t('settings.addMember')}>
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
            {t('settings.addedAs')}
            <input value={addedAs} onChange={(e) => setAddedAs(e.target.value)} className={`${inputClass} mt-1 font-normal`} />
          </label>
          <p className="mt-1 text-sm text-muted">{t('settings.addedAsHint')}</p>
        </section>

        {googleTasks}


        {!install.installed && (
          <section>
            <p className="mb-2 text-sm font-semibold">{t('settings.install')}</p>
            {install.canInstall ? (
              <button onClick={() => void install.install()} className={primaryButton}>
                <Download size={18} /> {t('settings.installButton')}
              </button>
            ) : (
              <p className="text-sm text-muted">{t('settings.installHint')}</p>
            )}
          </section>
        )}

      </div>
    </Dialog>
  );
}

export function ReorderListsDialog({ lists, onReorder, onClose }: { lists: ShoppingList[]; onReorder: (ids: string[]) => void; onClose: () => void }) {
  const t = useT();
  const ids = lists.map((l) => l.id);
  return (
    <Dialog title={t('lists.reorder')} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">{t('reorder.hint')}</p>
      <SortableRows
        ids={ids}
        label={(id) => {
          const list = lists.find((l) => l.id === id);
          return list ? listName(list) : id;
        }}
        onMove={(from, to) => onReorder(moveInOrder(ids, from, to))}
        renderRow={(id) => {
          const list = lists.find((l) => l.id === id)!;
          return (
            <>
              <ListIconBadge icon={list.icon} color={list.color} size="sm" />
              <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{listName(list)}</span>
            </>
          );
        }}
      />
      <button onClick={onClose} className={`${primaryButton} mt-4 w-full`}>
        {t('common.done')}
      </button>
    </Dialog>
  );
}
