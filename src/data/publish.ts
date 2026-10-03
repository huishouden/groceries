import type { AgendaInput } from '@huishouden/pwa-kit/agenda';
import { dinnerAgenda, type PlannedMeal } from './mealPlan';

// What Groceries shares with the rest of Huishouden: planned dinners on the household agenda (the
// portal's Calendar and Today). Worked out from the meal plan itself, so any device can publish it
// and it always matches the plan. Dated to-dos and their reminders are Huishouden Tasks'.

export const APP = 'groceries';

/** Everything Groceries puts on the household agenda: the planned dinners. */
export function agendaItems(plan: PlannedMeal[]): AgendaInput[] {
  return plan.filter((p) => p.type === 'dinner').map((p) => dinnerAgenda(p));
}
