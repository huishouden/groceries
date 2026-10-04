import { afterEach, describe, expect, it } from 'vitest';
import { setLangForTests } from '@huishouden/pwa-kit/i18n';
import '../../src/i18n';
import { mealName, mealPrep, menuPrompt, validateMeals } from '../../src/data/menus';
import { CATEGORIES, URGENCY, categoryLabel, listName, type ListItem, type ShoppingList } from '../../src/data/model';
import { todoItems } from '../../src/data/publish';
import { dinnerAgenda } from '../../src/data/mealPlan';

// Back to English, keeping the app's catalogue for the other test files.
afterEach(() => setLangForTests('en'));

const ctx = { have: ['chicken', 'rice'], onList: ['zucchini'], pantry: ['salt'], food: { people: [] } };
const reply = {
  meals: [
    {
      type: 'dinner',
      name: 'Chicken with rice',
      localName: 'Pollo con arroz',
      parts: [
        { ingredients: ['chicken'], prep: 'Baked with a little oil', localPrep: 'Al horno con poco aceite' },
        { ingredients: ['rice', 'zucchini'], prep: 'Steamed', localPrep: 'Al vapor' },
      ],
      extras: [],
      heat: 0,
      acidity: 0,
      richness: 0,
      sweetness: 0,
    },
  ],
};

describe('meal ideas in another language', () => {
  it('asks for a translation for display only when the household reads another language', async () => {
    expect(menuPrompt(ctx)).not.toContain('LANGUAGE');
    await setLangForTests('es');
    expect(menuPrompt(ctx)).toContain('LANGUAGE: Latin American Spanish');
  });

  it('keeps the English for the diet checks and shows the translation', async () => {
    await setLangForTests('es');
    const [meal] = validateMeals(reply, ctx).meals;
    expect(meal.name).toBe('Chicken with rice');
    expect(mealName(meal)).toBe('Pollo con arroz');
    expect(mealPrep(meal, 1)).toBe('Al vapor');
    await setLangForTests('nl');
    expect(mealName(meal)).toBe('Chicken with rice');
  });

  it('ignores a translation in English', () => {
    const [meal] = validateMeals(reply, ctx).meals;
    expect(meal.local).toBeUndefined();
  });
});

describe('fixed choices stored in English', () => {
  it('shows categories and default list names in the reader’s language; renamed lists as named', async () => {
    await setLangForTests('nl');
    expect(categoryLabel(CATEGORIES.PRODUCE)).toBe('Groente en fruit');
    expect(categoryLabel('Garden')).toBe('Garden');
    expect(listName({ id: 'groceries', name: 'Groceries' })).toBe('Boodschappen');
    expect(listName({ id: 'groceries', name: 'Weekly shop' })).toBe('Weekly shop');
  });
});

describe('what other devices read', () => {
  const lists: ShoppingList[] = [{ id: 'groceries', name: 'Groceries', description: '', icon: 'grocery', color: '#000', sortOrder: 0, createdAt: 0 }];
  const item = (name: string): ListItem => ({ id: name, listId: 'groceries', name, category: CATEGORIES.OTHER, quantity: '1', notes: '', addedBy: 'Alex', completed: false, urgency: URGENCY.URGENT, createdAt: 1, updatedAt: 1, completedAt: null });

  it('the to-do summary and planned dinners in Spanish', async () => {
    await setLangForTests('es');
    const [todo] = todoItems(lists, [item('milk'), item('eggs')]);
    expect(todo.title).toBe('Compras: 2 cosas en la lista');
    expect(todo.detail).toBe('Para hoy: 2');
    expect(dinnerAgenda({ day: '2031-01-06', name: 'Chicken with rice', meal: { name: 'Chicken with rice', local: { lang: 'es', name: 'Pollo con arroz', prep: [] } } }).title).toBe('Cena: Pollo con arroz');
  });
});
