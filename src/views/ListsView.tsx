import { useMemo, useState, type ReactNode } from 'react';
import { ArrowUpDown, ChevronDown, ListChecks, Plus, Search, Share2, Trash2, X } from 'lucide-react';
import { AddBar, type AddRequest } from '../components/AddBar';
import { usePref } from '../lib/prefs';
import { RoleNote } from '@huishouden/pwa-kit/react/roles';
import { ItemRow, aisleRowProps, type AisleProps } from '../components/ItemRow';
import { SortableItems } from '../components/SortableItems';
import { StaplesShelf } from '../components/StaplesShelf';
import { Chip, ListIconBadge, ghostButton } from '../components/ui';
import { useT } from '../i18n';
import { AISLE_ORDER, categoryLabel, formatListForSharing, listName, sortItems, type ListItem, type ShoppingList, type Staple } from '../data/model';

/** Huishouden Tasks on the suite's one site: the household's to-do lists (same origin, so staging links to staging). */
const TASKS_PATH = '/tasks/';

interface Props {
  /** The shopping banner (detected store, or the store being shopped), shown above the list. */
  banner?: ReactNode;
  lists: ShoppingList[];
  items: ListItem[];
  staples: Staple[];
  selectedList: ShoppingList;
  onSelectList: (id: string) => void;
  onNewList: () => void;
  onReorderLists: () => void;
  onDeleteList: (list: ShoppingList) => void;
  onAdd: (req: AddRequest) => void;
  onAddStaple: (s: Staple) => void;
  /** "Don't suggest": forgets the staple (with Undo). */
  onForgetStaple: (s: Staple) => void;
  onToggle: (item: ListItem) => void;
  aisle?: AisleProps;
  onEdit: (item: ListItem) => void;
  onDelete: (item: ListItem) => void;
  onClearCompleted: (items: ListItem[]) => void;
  onMove: (ordered: ListItem[], from: number, to: number) => void;
  /** Whether this person may change or delete the item: helpers and kids only their own. */
  mayChange?: (item: ListItem) => boolean;
  /** Creating, reordering and deleting lists: admins and members. */
  canSetUp?: boolean;
}

export function ListsView(props: Props) {
  const t = useT();
  const { lists, items, staples, selectedList } = props;
  const mine = (item: ListItem) => props.mayChange?.(item) !== false;
  const setUp = props.canSetUp !== false;
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showDone, setShowDone] = usePref('showDone', true);
  const [shared, setShared] = useState(false);

  const listItems = useMemo(() => items.filter((i) => i.listId === selectedList.id), [items, selectedList.id]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listItems.filter(
      (i) =>
        (!filter || i.category === filter) &&
        (!q || i.name.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q) || i.addedBy.toLowerCase().includes(q)),
    );
  }, [listItems, filter, search]);
  const pending = sortItems(visible.filter((i) => !i.completed));
  const done = visible.filter((i) => i.completed).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const categoryCounts = AISLE_ORDER.map((c) => [c, listItems.filter((i) => !i.completed && i.category === c).length] as const).filter(
    ([, n]) => n > 0,
  );
  const pendingCount = (listId: string) => items.filter((i) => i.listId === listId && !i.completed).length;

  async function share() {
    const text = formatListForSharing(listName(selectedList), listItems);
    if (navigator.share) {
      try {
        await navigator.share({ title: listName(selectedList), text });
        return;
      } catch {
        // Cancelled or unsupported payload; fall through to the clipboard.
      }
    }
    await navigator.clipboard.writeText(text);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  return (
    <div className="flex h-full min-h-0">
      <nav className="hidden w-72 shrink-0 flex-col gap-1 overflow-y-auto border-r border-stone-200 p-3 md:flex dark:border-forest-700" aria-label={t('modes.lists')}>
        {lists.map((l) => (
          <button
            key={l.id}
            onClick={() => props.onSelectList(l.id)}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
              l.id === selectedList.id ? 'bg-tint-strong' : 'hover:bg-stone-100 dark:hover:bg-forest-800'
            }`}
          >
            <ListIconBadge icon={l.icon} color={l.color} />
            <span className="min-w-0 flex-1 truncate font-medium">{listName(l)}</span>
            {pendingCount(l.id) > 0 && <span className="text-sm text-muted">{pendingCount(l.id)}</span>}
          </button>
        ))}
        {setUp ? (
          <button onClick={props.onNewList} className={`${ghostButton} mt-2 justify-start`}>
            <Plus size={18} /> {t('lists.new')}
          </button>
        ) : (
          <RoleNote action="change-settings" className="mt-2 px-3" />
        )}
        {setUp && lists.length > 1 && (
          <button onClick={props.onReorderLists} className={`${ghostButton} justify-start`}>
            <ArrowUpDown size={18} /> {t('lists.reorder')}
          </button>
        )}
        <a href={TASKS_PATH} className={`${ghostButton} mt-4 justify-start text-sm font-normal text-muted`}>
          <ListChecks size={18} /> {t('lists.todosInTasks')}
        </a>
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="scrollbar-none flex gap-2 overflow-x-auto border-b border-stone-200 px-4 py-2 md:hidden dark:border-forest-700">
          {/* One list needs no picker (its name is the heading below); New stays. */}
          {lists.length > 1 &&
            lists.map((l) => (
              <Chip key={l.id} active={l.id === selectedList.id} onClick={() => props.onSelectList(l.id)}>
                {listName(l)}
                {pendingCount(l.id) > 0 ? ` · ${pendingCount(l.id)}` : ''}
              </Chip>
            ))}
          {setUp && <Chip onClick={props.onNewList}>{lists.length > 1 ? t('lists.newShort') : t('lists.newChip')}</Chip>}
          {setUp && lists.length > 1 && <Chip onClick={props.onReorderLists}>{t('lists.reorderShort')}</Chip>}
          <a
            href={TASKS_PATH}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm whitespace-nowrap text-muted underline-offset-2 hover:underline"
          >
            <ListChecks size={16} /> {t('lists.todosInTasksShort')}
          </a>
        </div>

        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:p-6">
          {props.banner}
          <header className="flex items-center gap-3">
            <ListIconBadge icon={selectedList.icon} color={selectedList.color} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold">{listName(selectedList)}</h1>
              <p className="text-sm text-muted">
                {t('lists.counts', { open: listItems.filter((i) => !i.completed).length, done: listItems.filter((i) => i.completed).length })}
              </p>
            </div>
            <button onClick={() => void share()} className={ghostButton} aria-label={t('lists.share')}>
              <Share2 size={20} />
              <span className="hidden sm:inline">{shared ? t('lists.copied') : t('lists.shareShort')}</span>
            </button>
            {setUp && (
              <button
                onClick={() => {
                  if (confirm(t('lists.deleteConfirm', { name: listName(selectedList), count: listItems.length }))) props.onDeleteList(selectedList);
                }}
                className={`${ghostButton} text-stone-400`}
                aria-label={t('lists.delete')}
              >
                <Trash2 size={20} />
              </button>
            )}
          </header>

          <AddBar staples={staples} listIcon={selectedList.icon} onAdd={props.onAdd} onForget={props.onForgetStaple} />
          <StaplesShelf staples={staples} activeItems={listItems} onAdd={props.onAddStaple} onForget={props.onForgetStaple} />

          {(listItems.length > 6 || search) && (
            <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-surface px-3 dark:border-forest-700">
              <Search size={18} className="text-stone-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('lists.search')} className="min-w-0 flex-1 bg-transparent py-2 outline-none" />
              {search && (
                <button onClick={() => setSearch('')} aria-label={t('lists.clearSearch')}>
                  <X size={18} className="text-stone-400" />
                </button>
              )}
            </div>
          )}

          {categoryCounts.length > 1 && (
            <div className="scrollbar-none flex gap-2 overflow-x-auto">
              <Chip active={!filter} onClick={() => setFilter(null)}>
                {t('lists.all')}
              </Chip>
              {categoryCounts.map(([c, n]) => (
                <Chip key={c} active={filter === c} onClick={() => setFilter(filter === c ? null : c)}>
                  {categoryLabel(c)} ({n})
                </Chip>
              ))}
            </div>
          )}

          {pending.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
              {listItems.length === 0 ? t('lists.empty') : t('lists.allDone')}
            </p>
          ) : (
            <SortableItems
              items={pending}
              // Moving within a filtered view has no clear place among the hidden items.
              disabled={Boolean(filter || search.trim())}
              onMove={(from, to) => props.onMove(pending, from, to)}
              renderItem={(item, drag) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  drag={drag}
                  onToggle={() => props.onToggle(item)} {...aisleRowProps(props.aisle, item)}
                  onEdit={mine(item) ? () => props.onEdit(item) : undefined}
                  onDelete={mine(item) ? () => props.onDelete(item) : undefined}
                  showCategory={!filter}
                />
              )}
            />
          )}

          {done.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <button onClick={() => setShowDone(!showDone)} aria-expanded={showDone} className={`${ghostButton} -ml-3`}>
                  <ChevronDown size={18} className={showDone ? 'rotate-180' : ''} /> {t('lists.done', { count: done.length })}
                </button>
                {done.some(mine) && (
                  <button onClick={() => props.onClearCompleted(listItems.filter(mine))} className={`${ghostButton} text-sm`}>
                    {t('lists.clearDone')}
                  </button>
                )}
              </div>
              {showDone && (
                <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2">
                  {done.map((item) => (
                    <ItemRow key={item.id} item={item} onToggle={() => props.onToggle(item)} {...aisleRowProps(props.aisle, item)} onDelete={mine(item) ? () => props.onDelete(item) : undefined} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
