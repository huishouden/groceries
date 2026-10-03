import { describe, expect, it } from 'vitest';
import { allDayStart } from '@huishouden/pwa-kit/agenda';
import { APP, agendaItems } from '../../src/data/publish';
import type { PlannedMeal } from '../../src/data/mealPlan';

const planned = (day: PlannedMeal['day'], type: PlannedMeal['type'], name: string): PlannedMeal => ({
  day,
  type,
  name,
  meal: {} as PlannedMeal['meal'],
  by: 'alex@example.com',
  updatedAt: 0,
});

describe('agendaItems', () => {
  it('publishes planned dinners as all-day entries linking to Meals, and no other meals', () => {
    const all = agendaItems([planned('2031-01-07', 'dinner', 'Mushroom rice bowl'), planned('2031-01-07', 'lunch', 'Egg sandwich')]);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ title: 'Dinner: Mushroom rice bowl', allDay: true, start: allDayStart('2031-01-07'), kind: 'other' });
    expect(all[0].url).toMatch(/\/groceries\/\?mode=meals$/);
  });

  it('is published under Groceries, apart from Tasks’ dated to-dos', () => {
    expect(APP).toBe('groceries');
  });
});
