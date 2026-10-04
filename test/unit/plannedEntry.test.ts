import { describe, expect, it } from 'vitest';
import { allDayStart } from '@huishouden/pwa-kit/agenda';
import { googleTemplateUrl } from '@huishouden/pwa-kit/calendar-export';
import { dinnerAgenda, plannedEntry } from '../../src/data/mealPlan';

describe('plannedEntry: Add to calendar for a planned meal', () => {
  it('a dinner is what the agenda shows; breakfast and lunch read the same way', () => {
    expect(plannedEntry({ day: '2031-01-06', type: 'dinner', name: 'Tacos' })).toEqual(dinnerAgenda({ day: '2031-01-06', name: 'Tacos' }));
    expect(plannedEntry({ day: '2031-01-07', type: 'lunch', name: 'Soup' })).toMatchObject({ title: 'Lunch: Soup', start: allDayStart('2031-01-07'), allDay: true });
  });

  it('goes into Google Calendar as an all-day event on its day', () => {
    const url = new URL(googleTemplateUrl(plannedEntry({ day: '2031-01-06', type: 'dinner', name: 'Tacos' })));
    expect(url.searchParams.get('text')).toBe('Dinner: Tacos');
    expect(url.searchParams.get('dates')).toBe('20310106/20310107');
  });
});
