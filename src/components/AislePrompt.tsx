import { useState } from 'react';
import { Signpost, X } from 'lucide-react';
import { useT } from '../i18n';
import { richT } from '../lib/rich';

/**
 * Asks where the item just checked off was, from a bar pinned to the bottom of the screen, so it
 * stays in view while the item moves into Done. Optional: Skip, or just keep shopping.
 */
export function AislePrompt({ itemName, storeName, onSave, onSkip }: { itemName: string; storeName: string; onSave: (aisle: string) => void; onSkip: () => void }) {
  const t = useT();
  const [value, setValue] = useState('');
  return (
    <div className="safe-bottom fixed inset-x-0 bottom-(--hh-bottom-nav) z-40 flex justify-center px-3 pt-2">
      <form
        role="region"
        aria-label={t('aisle.forAt', { name: itemName, store: storeName })}
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSave(value);
        }}
        className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 shadow-lg"
      >
        <Signpost size={18} className="shrink-0 text-positive" />
        <span className="min-w-0 flex-1 text-sm leading-tight [overflow-wrap:anywhere]">
          {richT('aisle.which', { name: <strong translate="no">{itemName}</strong> })}
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('aisle.example')}
          aria-label={t('aisle.for', { name: itemName })}
          enterKeyHint="done"
          maxLength={24}
          className="w-20 shrink-0 rounded-xl border border-line bg-white px-2 py-1 text-sm outline-none focus:border-forest-500 dark:bg-forest-900"
        />
        <button type="submit" disabled={!value.trim()} className="shrink-0 rounded-xl bg-primary px-2.5 py-1 text-sm font-semibold text-on-primary disabled:opacity-40">
          {t('common.save')}
        </button>
        <button type="button" onClick={onSkip} className="shrink-0 rounded-xl p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200" aria-label={t('aisle.skip')}>
          <X size={18} />
        </button>
      </form>
    </div>
  );
}
