import { useState } from 'react';
import { SuggestionChip } from '@huishouden/pwa-kit/react/ui';
import type { ListItem, Staple } from '../data/model';

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
  const [editing, setEditing] = useState(false);
  const shown = topStaples(staples, activeItems, limit);
  if (shown.length === 0) return null;
  return (
    <section aria-label="Frequent items">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wider text-stone-500 uppercase dark:text-stone-400">
          {editing ? 'Tap × to stop suggesting' : 'Running low? Tap to add'}
        </h3>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          aria-label={editing ? 'Done editing suggestions' : 'Edit suggestions'}
          className="-mr-2 inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-forest-700 hover:bg-forest-50 dark:text-forest-300 dark:hover:bg-forest-700"
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      <div className={`flex gap-2 ${large ? 'flex-wrap' : 'scrollbar-none overflow-x-auto pb-1'}`}>
        {shown.map((s) => (
          <SuggestionChip
            key={s.id}
            label={s.displayName}
            large={large}
            editing={editing}
            hint="Adding it again brings it back."
            onPick={() => onAdd(s)}
            onRemove={() => onForget(s)}
          />
        ))}
      </div>
    </section>
  );
}
