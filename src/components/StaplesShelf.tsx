import { useState } from 'react';
import { SuggestionChip } from '@huishouden/pwa-kit/react/ui';
import type { ListItem, Staple } from '../data/model';
import { useT } from '../i18n';

interface Props {
  staples: Staple[];
  activeItems: ListItem[];
  onAdd: (staple: Staple) => void;
  /** "Don't suggest": a long press on a chip, or Edit and its ×. */
  onForget: (staple: Staple) => void;
  limit?: number;
  large?: boolean;
}

/** Things the household adds most often, minus anything already on the list. */
export function topStaples(staples: Staple[], activeItems: ListItem[], limit: number): Staple[] {
  const onList = new Set(activeItems.filter((i) => !i.completed).map((i) => i.name.trim().toLowerCase()));
  return staples
    .filter((s) => s.displayName && (s.timesAdded ?? 0) >= 2 && !onList.has(s.displayName.toLowerCase()))
    .sort((a, b) => b.timesAdded - a.timesAdded || b.lastAddedAt - a.lastAddedAt)
    .slice(0, limit);
}

export function StaplesShelf({ staples, activeItems, onAdd, onForget, limit = 12, large }: Props) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const shown = topStaples(staples, activeItems, limit);
  if (shown.length === 0) return null;
  return (
    <section aria-label={t('staples.label')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
          {editing ? t('staples.editing') : t('staples.title')}
        </h3>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          aria-label={editing ? t('staples.doneEditing') : t('staples.edit')}
          className="-mr-2 inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-link hover:bg-tint"
        >
          {editing ? t('common.done') : t('common.edit')}
        </button>
      </div>
      <div className={`flex gap-2 ${large ? 'flex-wrap' : 'scrollbar-none overflow-x-auto pb-1'}`}>
        {shown.map((s) => (
          <SuggestionChip
            key={s.id}
            label={s.displayName}
            large={large}
            editing={editing}
            hint={t('staples.hint')}
            onPick={() => onAdd(s)}
            onRemove={() => onForget(s)}
          />
        ))}
      </div>
    </section>
  );
}
