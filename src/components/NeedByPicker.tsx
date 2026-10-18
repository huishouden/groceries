import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import { needByChoiceLabel, needByChoices } from '@huishouden/pwa-kit/need-by';
import { isYmd, shortDate, type Ymd } from '@huishouden/pwa-kit/time';
import { Chip, inputClass } from './ui';
import { UNDATED_URGENCIES, URGENCY, urgencyLabel, type Urgency } from '../data/model';
import { useT } from '../i18n';

export interface NeedByChoice {
  /** The day it is needed by, or null for none. */
  needBy: Ymd | null;
  /** With no day: Standard or Whenever. */
  urgency: Urgency;
}

/**
 * When an item is needed: no date (then Standard or Whenever), today, tomorrow, the next few
 * weekdays by name, or a date picked on the calendar. A day already set that is no longer offered
 * (passed, or picked further ahead) stays selected as its own chip.
 */
export function NeedByPicker({ value, today, onChange, large }: { value: NeedByChoice; today: Ymd; onChange: (next: NeedByChoice) => void; large?: boolean }) {
  const t = useT();
  const choices = needByChoices(today);
  const other = value.needBy && !choices.includes(value.needBy) ? value.needBy : null;
  const [picking, setPicking] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!picking) return;
    const input = dateRef.current;
    input?.focus();
    // Opens the calendar where the browser can; elsewhere the field is there to type in.
    try {
      input?.showPicker?.();
    } catch {
      // Not allowed without a fresh tap in some browsers: the field stays.
    }
  }, [picking]);
  const chips = useRef<HTMLDivElement>(null);
  const pick = (needBy: Ymd | null, fromField = false) => {
    setPicking(false);
    onChange({ needBy, urgency: needBy ? URGENCY.NORMAL : value.urgency === URGENCY.WHENEVER ? URGENCY.WHENEVER : URGENCY.NORMAL });
    // The date field closes under the keyboard's focus: hand it to the chip now showing the day.
    if (fromField) requestAnimationFrame(() => chips.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus());
  };

  return (
    <div className={`grid gap-2 ${large ? 'text-base' : 'text-sm'} text-muted`}>
      <div role="group" aria-label={t('needBy.label')}>
        <span className="mb-1 block">{t('needBy.label')}</span>
        <div ref={chips} className="flex flex-wrap gap-1.5">
          <Chip active={!value.needBy} onClick={() => pick(null)}>
            {t('needBy.none')}
          </Chip>
          {choices.map((day) => (
            <Chip key={day} active={value.needBy === day} onClick={() => pick(day)}>
              {needByChoiceLabel(day, today)}
            </Chip>
          ))}
          <DateChip active={!!other || picking} expanded={picking} onClick={() => setPicking(other ? true : !picking)}>
            <CalendarDays size={14} aria-hidden="true" /> {other ? shortDate(other, today) : t('needBy.pick')}
          </DateChip>
        </div>
        {picking && (
          <input
            ref={dateRef}
            type="date"
            min={today}
            value={value.needBy ?? ''}
            aria-label={t('needBy.dateLabel')}
            onChange={(e) => {
              if (isYmd(e.target.value) && e.target.value >= today) pick(e.target.value, true);
            }}
            className={`${inputClass} mt-2 max-w-48`}
          />
        )}
      </div>
      {!value.needBy && (
        <div role="group" aria-label={t('item.when')}>
          <span className="mb-1 block">{t('item.when')}</span>
          <div className="flex flex-wrap gap-1.5">
            {UNDATED_URGENCIES.map((u) => (
              <Chip key={u} active={value.urgency === u || (u === URGENCY.NORMAL && value.urgency === URGENCY.URGENT)} onClick={() => onChange({ needBy: null, urgency: u })}>
                {urgencyLabel(u)}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The kit's Chip, as a disclosure: it opens the date field below, so it says whether that is open. */
function DateChip({ active, expanded, onClick, children }: { active: boolean; expanded: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-expanded={expanded}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
        active ? 'border-forest-700 bg-forest-700 text-white dark:border-forest-300 dark:bg-forest-300 dark:text-forest-900' : 'border-line bg-surface text-ink-soft hover:border-forest-400'
      }`}
    >
      {children}
    </button>
  );
}
