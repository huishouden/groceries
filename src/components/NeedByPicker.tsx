import { useEffect, useRef, useState } from 'react';
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
  const pick = (needBy: Ymd | null) => {
    setPicking(false);
    onChange({ needBy, urgency: needBy ? URGENCY.NORMAL : value.urgency === URGENCY.WHENEVER ? URGENCY.WHENEVER : URGENCY.NORMAL });
  };

  return (
    <div className={`grid gap-2 ${large ? 'text-base' : 'text-sm'} text-muted`}>
      <div role="group" aria-label={t('needBy.label')}>
        <span className="mb-1 block">{t('needBy.label')}</span>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!value.needBy} onClick={() => pick(null)}>
            {t('needBy.none')}
          </Chip>
          {choices.map((day) => (
            <Chip key={day} active={value.needBy === day} onClick={() => pick(day)}>
              {needByChoiceLabel(day, today)}
            </Chip>
          ))}
          {other && (
            <Chip active onClick={() => setPicking(true)}>
              <CalendarDays size={14} aria-hidden="true" /> {shortDate(other, today)}
            </Chip>
          )}
          {!other && (
            <Chip active={picking} onClick={() => setPicking(!picking)}>
              <CalendarDays size={14} aria-hidden="true" /> {t('needBy.pick')}
            </Chip>
          )}
        </div>
        {picking && (
          <input
            ref={dateRef}
            type="date"
            min={today}
            value={value.needBy ?? ''}
            aria-label={t('needBy.dateLabel')}
            onChange={(e) => {
              if (isYmd(e.target.value) && e.target.value >= today) pick(e.target.value);
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
