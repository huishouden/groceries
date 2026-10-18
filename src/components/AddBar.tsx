import { useEffect, useMemo, useRef, useState } from 'react';
import { AddByPhotoButton } from '@huishouden/pwa-kit/react/product-photo';
import { ChevronDown, Plus, X } from 'lucide-react';
import type { Ymd } from '@huishouden/pwa-kit/time';
import {
  ALL_CATEGORIES,
  CATEGORIES,
  URGENCY,
  categoryLabel,
  matchSuggestions,
  todayOf,
  type Category,
  type ListIcon,
  type Staple,
  type Urgency,
} from '../data/model';
import { inputClass } from './ui';
import { NeedByPicker, type NeedByChoice } from './NeedByPicker';
import { useT } from '../i18n';
import { closeEnough, guessCategory } from '../data/categorize';

export interface AddRequest {
  name: string;
  quantity: string;
  notes: string;
  category: Category;
  urgency: Urgency;
  /** The day it is needed by, or null for none. */
  needBy: Ymd | null;
}

interface Props {
  staples: Staple[];
  onAdd: (req: AddRequest) => void;
  /** "Don't suggest": the × beside a suggestion forgets that staple (with Undo). */
  onForget: (staple: Staple) => void;
  large?: boolean;
  placeholder?: string;
  /** The list's kind, so the aisle shown in the details matches what will be saved. */
  listIcon?: ListIcon;
  /** Add by photo: the camera button beside the field opens it. Without it, no camera button. */
  onPhoto?: () => void;
  /** Each change puts the cursor in the field (Add by photo's "Type instead"). */
  focusSignal?: number;
}

export function AddBar({ staples, onAdd, onForget, large, placeholder, listIcon, onPhoto, focusSignal }: Props) {
  const t = useT();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [need, setNeed] = useState<NeedByChoice>({ needBy: null, urgency: URGENCY.NORMAL });
  const [showDetails, setShowDetails] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusSignal) inputRef.current?.focus();
  }, [focusSignal]);

  const suggestions = useMemo(() => {
    const exact = matchSuggestions(staples, name);
    // Nothing spelled that way: offer close spellings ("zuchini" → "Zucchini").
    const found = exact.length > 0 ? exact : staples.filter((st) => closeEnough(name, st.displayName)).slice(0, 6);
    return found.filter((st) => st.displayName.toLowerCase() !== name.trim().toLowerCase());
  }, [staples, name]);
  const effectiveCategory = category ?? (name.trim() ? guessCategory(name, listIcon) : CATEGORIES.OTHER);

  function reset() {
    setName('');
    setQuantity('');
    setNotes('');
    setCategory(null);
    setNeed({ needBy: null, urgency: URGENCY.NORMAL });
    inputRef.current?.focus();
  }

  function submit(chosen?: Staple) {
    // Typing an existing staple in different case reuses its saved spelling and aisle.
    const override = chosen ?? staples.find((s) => s.displayName.toLowerCase() === name.trim().toLowerCase());
    const finalName = override?.displayName ?? name;
    if (!finalName.trim()) return;
    onAdd({
      name: finalName,
      quantity: quantity || override?.defaultQuantity || '1',
      notes,
      category: override?.category ?? effectiveCategory,
      urgency: need.urgency,
      needBy: need.needBy,
    });
    reset();
  }

  return (
    <div className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`flex items-center gap-2 rounded-2xl border border-line bg-surface p-1.5 shadow-sm focus-within:border-forest-500 ${large ? 'p-2' : ''}`}
      >
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocused(true)}
          // Delayed so a tap on a suggestion lands first; skipped if focus already came back
          // (adding an item refocuses the input right after the Add button took focus).
          onBlur={() => setTimeout(() => setFocused(document.activeElement === inputRef.current), 150)}
          placeholder={placeholder ?? t('add.placeholder')}
          enterKeyHint="done"
          autoComplete="off"
          className={`min-w-0 flex-1 bg-transparent px-3 outline-none ${large ? 'py-3 text-xl' : 'py-2 text-base'}`}
          aria-label={t('add.newItem')}
        />
        {onPhoto && <AddByPhotoButton onClick={onPhoto} large={large} />}
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className={`rounded-xl p-2 text-muted hover:bg-stone-100 dark:hover:bg-forest-700 ${showDetails ? 'bg-stone-100 dark:bg-forest-700' : ''}`}
          aria-label={t('add.moreDetails')}
          aria-expanded={showDetails}
        >
          <ChevronDown size={20} className={showDetails ? 'rotate-180 transition' : 'transition'} />
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className={`inline-flex items-center gap-1.5 rounded-xl bg-primary font-semibold text-on-primary disabled:opacity-40 ${large ? 'px-6 py-3 text-lg' : 'px-4 py-2'}`}
        >
          <Plus size={large ? 22 : 18} strokeWidth={2.5} /> {t('common.add')}
        </button>
      </form>

      {focused && suggestions.length > 0 && (
        <ul className="absolute right-0 left-0 z-20 mt-1 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
          {suggestions.map((s) => (
            <li key={s.id} className="flex items-center">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submit(s)}
                className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 py-2.5 pl-4 text-left hover:bg-tint"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{s.displayName}</span>
                  <span className="ml-2 text-sm text-muted">{categoryLabel(s.category)}</span>
                </span>
                {s.timesAdded > 0 && <span className="shrink-0 text-sm text-muted">{t('add.timesAdded', { count: s.timesAdded })}</span>}
              </button>
              {/* Keeps the field focused, so the list stays open for the next one. */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onForget(s)}
                aria-label={t('add.dontSuggest', { name: s.displayName })}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-forest-700 dark:hover:text-stone-200"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showDetails && (
        <div className="mt-2 grid gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-2">
          <label className="text-sm text-muted">
            {t('item.quantity')}
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t('item.quantityPlaceholder')} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm text-muted">
            {t('common.notes')}
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('item.notesPlaceholder')} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm text-muted">
            {t('item.section')}
            <select value={effectiveCategory} onChange={(e) => setCategory(e.target.value as Category)} className={`${inputClass} mt-1`}>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <NeedByPicker value={need} today={todayOf(Date.now())} onChange={setNeed} />
        </div>
      )}
    </div>
  );
}
