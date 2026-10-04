import { useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { Check, Pencil, Search, Signpost, Trash2, Zap } from 'lucide-react';
import { aisleLabel } from '../data/stores';
import type { StoreLink } from '../data/chains';
import { URGENCY, categoryLabel, type ListItem } from '../data/model';
import { useT } from '../i18n';

interface Props {
  item: ListItem;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  large?: boolean;
  showCategory?: boolean;
  /** Where this item was found at the store being shopped, if anyone recorded it. */
  aisle?: string;
  onAisle?: (aisle: string) => void;
  onDismissAisle?: () => void;
  /** The store being shopped's own search for this item, so its website or app can show the aisle. */
  findAt?: StoreLink | null;
  /** Present when the row can be reordered: the grip, plus what the drag library attaches to the row. */
  drag?: DragProps;
}

/** Aisle support passed down from the app while a store is known. */
export interface AisleProps {
  aisleFor: (item: ListItem) => string | undefined;
  onAisle: (item: ListItem, aisle: string) => void;
  onDismissAisle: () => void;
  findAt?: (item: ListItem) => StoreLink | null;
}

export function aisleRowProps(aisle: AisleProps | undefined, item: ListItem): Partial<Props> {
  if (!aisle) return {};
  return {
    aisle: aisle.aisleFor(item),
    onAisle: (v: string) => aisle.onAisle(item, v),
    onDismissAisle: aisle.onDismissAisle,
    findAt: aisle.findAt?.(item),
  };
}

export interface DragProps {
  handle: ReactNode;
  rowRef: Ref<HTMLLIElement>;
  rowStyle: CSSProperties;
  dragging: boolean;
}

export function ItemRow({ item, onToggle, onEdit, onDelete, large, showCategory, drag, aisle, onAisle, onDismissAisle, findAt }: Props) {
  const t = useT();
  const [editingAisle, setEditingAisle] = useState(false);
  const showAisleInput = !!onAisle && editingAisle;
  const urgent = item.urgency === URGENCY.URGENT && !item.completed;
  const details = [
    item.quantity && item.quantity !== '1' ? item.quantity : null,
    item.notes || null,
    showCategory ? categoryLabel(item.category) : null,
  ].filter(Boolean);
  return (
    <li
      ref={drag?.rowRef}
      style={drag?.rowStyle}
      className={`group flex min-w-0 ${drag?.dragging ? 'relative z-10 shadow-lg' : ''} items-center gap-3 rounded-2xl border bg-white px-3 dark:bg-forest-800 ${large ? 'py-4' : 'py-2.5'} ${
        urgent ? 'border-terracotta/60' : 'border-stone-200/80 dark:border-forest-700'
      } ${item.completed ? 'opacity-60' : ''}`}
    >
      {drag?.handle}
      <button
        onClick={onToggle}
        aria-label={item.completed ? t('item.markNotDone', { name: item.name }) : t('item.markDone', { name: item.name })}
        className={`flex shrink-0 items-center justify-center rounded-full border-2 transition ${large ? 'h-10 w-10' : 'h-8 w-8'} ${
          item.completed
            ? 'border-forest-500 bg-forest-500 text-white'
            : 'border-stone-300 hover:border-forest-500 dark:border-forest-500'
        }`}
      >
        {item.completed && <Check size={large ? 22 : 18} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={onEdit ?? onToggle} className="block w-full text-left">
          <span className={`${large ? 'text-xl' : 'text-base'} ${item.completed ? 'line-through' : ''}`}>
            <span className="font-medium [overflow-wrap:anywhere]" translate="no">{item.name}</span>
            {urgent && (
              <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-attention-tint px-2 py-0.5 align-middle text-xs font-semibold text-attention">
                <Zap size={12} /> {t('item.today')}
              </span>
            )}
          </span>
          {(details.length > 0 || item.addedBy) && (
            <span className={`block text-muted [overflow-wrap:anywhere] ${large ? 'text-base' : 'text-sm'}`}>
              {details.join(' · ')}
              {details.length > 0 && item.addedBy ? ' · ' : ''}
              <span translate="no">{item.addedBy}</span>
            </span>
          )}
        </button>
        {showAisleInput && (
          <AisleInput
            itemName={item.name}
            initial={aisle ?? ''}
            correcting
            onSave={(v) => {
              onAisle?.(v);
              setEditingAisle(false);
            }}
            onCancel={() => {
              setEditingAisle(false);
              onDismissAisle?.();
            }}
          />
        )}
        {((aisle && onAisle) || (findAt && !item.completed)) && !showAisleInput && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {aisle && onAisle && !showAisleInput && (
              <button
                onClick={() => setEditingAisle(true)}
                className={`inline-flex items-center gap-1 rounded-full bg-tint px-2 py-0.5 font-medium text-forest-700 dark:text-forest-100 ${large ? 'text-base' : 'text-sm'}`}
                aria-label={t('aisle.change', { aisle: aisleLabel(aisle), name: item.name })}
              >
                <Signpost size={14} /> {aisleLabel(aisle)}
              </button>
            )}
            {findAt && !item.completed && <FindAtLink link={findAt} itemName={item.name} secondary={!!aisle} large={large} />}
          </div>
        )}
      </div>
      {onEdit && (
        <button onClick={onEdit} className="hidden shrink-0 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 sm:block dark:hover:bg-forest-700 dark:hover:text-stone-200" aria-label={t('item.edit', { name: item.name })}>
          <Pencil size={18} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} className="shrink-0 rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-300" aria-label={t('item.delete', { name: item.name })}>
          <Trash2 size={18} />
        </button>
      )}
    </li>
  );
}

/** Opens the store's own search for the item; once its aisle is known it steps back. */
export function FindAtLink({ link, itemName, secondary, large }: { link: StoreLink; itemName: string; secondary?: boolean; large?: boolean }) {
  const t = useT();
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      aria-label={link.storeSite ? t('findAt.label', { name: itemName, store: link.store }) : t('findAt.webLabel', { name: itemName, store: link.store })}
      className={`inline-flex max-w-full min-w-0 items-center gap-1 underline-offset-2 hover:underline ${large ? 'text-base' : 'text-sm'} ${
        secondary ? 'text-muted' : 'font-medium text-link'
      }`}
    >
      <Search size={14} className="shrink-0" /> <span className="truncate">{t('findAt.text', { store: link.store })}</span>
    </a>
  );
}

function AisleInput({ itemName, initial, correcting, onSave, onCancel }: { itemName: string; initial: string; correcting: boolean; onSave: (v: string) => void; onCancel: () => void }) {
  const t = useT();
  const [value, setValue] = useState(initial);
  return (
    <form
      className="mt-1.5 flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <Signpost size={14} className="shrink-0 text-positive" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={correcting ? t('aisle.foundIn') : t('aisle.placeholder')}
        aria-label={correcting ? t('aisle.whereWas', { name: itemName }) : t('aisle.for', { name: itemName })}
        inputMode="text"
        enterKeyHint="done"
        maxLength={24}
        className="w-28 min-w-0 rounded-xl border border-line bg-white px-2 py-1 text-sm outline-none focus:border-forest-500 dark:bg-forest-900"
      />
      <button type="submit" disabled={!value.trim() && !correcting} className="rounded-xl bg-primary px-2 py-1 text-sm font-medium text-on-primary disabled:opacity-40">
        {t('common.save')}
      </button>
      <button type="button" onClick={onCancel} className="rounded-xl px-1.5 py-1 text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
        {t('common.cancel')}
      </button>
    </form>
  );
}
