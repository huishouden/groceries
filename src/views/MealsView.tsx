import { useEffect, useId, useMemo, useState } from 'react';
import { CalendarPlus, Candy, ChevronDown, Citrus, Droplet, Flame, Leaf, ListPlus, Loader2, Plus, Sparkles, Star, Trash2, X } from 'lucide-react';
import { GENTLE_DIETS, dietTags, gentleOnReflux, isStrict, mealLevels, type MealLevels } from '../data/diet';
import { ErrorNotice } from '../components/ErrorNotice';
import { Badge, Chip, Dialog, ghostButton, inputClass, primaryButton } from '../components/ui';
import { friendlyError, type FriendlyError } from '../lib/errors';
import { useOnline, usePref } from '../lib/prefs';
import { dietLabel, householdDiets, type FoodPreferences } from '@huishouden/pwa-kit/food';
import { capitalize, formatList, getLocale } from '@huishouden/pwa-kit/i18n';
import { t, useT } from '../i18n';
import { groupMeals, mealLabel, mealName, mealPrep, heatLimit, kitchenInventory, mealIngredients, mealKey, pantryOf, plannedGroceries, type FavoriteMeal, type Meal, type MealContext, type Menu, type ValidatedMeals } from '../data/menus';
import { listName, type ListItem, type ShoppingList } from '../data/model';
import { PLAN_TYPES, firstFreeDay, type PlanType, type PlannedMeal } from '../data/mealPlan';
import { daysBetween, formatDayShort, relativeDay, toYmd, ymdToTime, type Ymd } from '@huishouden/pwa-kit/time';

interface Props {
  lists: ShoppingList[];
  items: ListItem[];
  menus: Menu[];
  favorites: FavoriteMeal[];
  /** The household's diets and pantry (portal settings); null until read or when unavailable. */
  food: FoodPreferences | null;
  suggest: (ctx: MealContext) => Promise<ValidatedMeals>;
  onSave: (ingredients: string[], meals: Meal[]) => Promise<string>;
  onDelete: (id: string) => void;
  onSaveFavorite: (meal: Meal) => Promise<void>;
  onRemoveFavorite: (id: string) => Promise<void>;
  /** Adds each name to the list with the same note. */
  onAddItems: (listId: string, names: string[], notes: string) => void;
  /** The week shown in the plan, today first. */
  planWeek: Ymd[];
  plan: PlannedMeal[];
  onPlan: (day: Ymd, type: PlanType, meal: Meal) => Promise<void>;
  onUnplan: (day: Ymd, type: PlanType) => Promise<void>;
  /**
   * A helper or kid: meal ideas, favourites and the plan are the household's choices, so they see
   * them and can put ingredients on a list, but don't suggest, save or plan.
   */
  readOnly?: boolean;
}

const MIN_INGREDIENTS = 3;

/**
 * Meal ideas from what is in the kitchen (bought in the last 10 days) and what is still on the food
 * lists, so a week can be planned before shopping, within the household's diets.
 */
export function MealsView({ lists, items, menus, favorites, food, suggest, onSave, onDelete, onSaveFavorite, onRemoveFavorite, onAddItems, planWeek, plan, onPlan, onUnplan, readOnly = false }: Props) {
  const t = useT();
  const [planning, setPlanning] = useState<Meal | null>(null);
  const bought = useMemo(() => kitchenInventory(items, lists, Date.now()), [items, lists]);
  const planned = useMemo(() => plannedGroceries(items, lists).filter((p) => !bought.some((b) => b.toLowerCase() === p.toLowerCase())), [items, lists, bought]);
  const pantry = pantryOf(food);
  const people = food?.people ?? [];
  const diets = householdDiets({ people });
  const strictDiets = diets.filter(isStrict);
  const gentleDiets = diets.filter((d) => GENTLE_DIETS.includes(d));
  const heat = heatLimit({ people });
  const reflux = gentleDiets.includes('gerd');
  const [dropped, setDropped] = useState<ValidatedMeals['droppedDiet']>([]);
  const [usedUp, setUsedUp] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [saveError, setSaveError] = useState<FriendlyError | null>(null);
  const online = useOnline();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favoritesOpen, setFavoritesOpen] = usePref('favoritesOpen', true);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const have = [...bought.filter((b) => !usedUp.has(b)), ...extras];
  const onList = planned.filter((p) => !usedUp.has(p));
  const available = [...have, ...onList];
  const ctx: MealContext = { have, onList, pantry, food: { people } };
  const shown = menus.find((m) => m.id === selectedId) ?? menus[0];
  const savedIds = new Set(favorites.map((f) => f.id));
  const groceries = lists.find((l) => l.icon === 'grocery') ?? lists[0];

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function toggleFavorite(meal: Meal) {
    setSaveError(null);
    const id = mealKey(meal);
    const write = savedIds.has(id) ? onRemoveFavorite(id) : onSaveFavorite(meal);
    write.catch((e: unknown) => setSaveError(friendlyError(e, 'save')));
  }

  function card(meal: Meal, key: string, label?: string) {
    return (
      <MealCard
        key={key}
        meal={meal}
        label={label}
        saved={savedIds.has(mealKey(meal))}
        listName={groceries ? listName(groceries) : undefined}
        sources={mealIngredients(meal, ctx)}
        reflux={reflux}
        onToggleSaved={readOnly ? undefined : () => toggleFavorite(meal)}
        onAdd={() => setAdding(meal)}
        onPlan={readOnly || meal.type === 'snack' ? undefined : () => setPlanning(meal)}
        onAddExtras={(names) => {
          if (!groceries) return;
          onAddItems(groceries.id, names, t('meals.forMeal', { meal: mealName(meal) }));
          setNotice(t('meals.addedTo', { count: names.length, list: listName(groceries) }));
        }}
      />
    );
  }

  function toggle(name: string) {
    setUsedUp((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function run() {
    setBusy(true);
    setError(null);
    setDropped([]);
    try {
      const result = await suggest(ctx);
      setDropped(result.droppedDiet);
      setSelectedId(await onSave(available, result.meals));
    } catch (e) {
      setError(friendlyError(e, 'meals'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 p-4 sm:p-6">
      {readOnly ? (
        <section className="grid gap-1 rounded-3xl bg-surface p-4 sm:p-5">
          <h1 className="text-2xl font-bold">{t('modes.meals')}</h1>
          <p className="text-sm text-muted">{t('meals.readOnly')}</p>
        </section>
      ) : (
      <section className="grid gap-3 rounded-3xl bg-surface p-4 sm:p-5">
        <div>
          <h1 className="text-2xl font-bold">{t('meals.title')}</h1>
          <p className="text-sm text-muted">{t('meals.intro')}</p>
          {strictDiets.length > 0 && (
            <p className="mt-1 text-sm font-medium text-link">
              {t('meals.fits', { who: formatList(whoHas(people, (d) => isStrict(d))) })}
            </p>
          )}
          {heat && heat.max < 3 && (
            <p className="mt-1 text-sm font-medium text-link">
              {t('meals.heat', { max: heat.max, who: heat.who })}
            </p>
          )}
          {gentleDiets.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              {t('meals.gentle', { who: formatList(whoHas(people, (d) => !isStrict(d), true)) })}
            </p>
          )}
        </div>
        {bought.length + extras.length > 0 && <h2 className="text-sm font-semibold text-muted">{t('meals.have')}</h2>}
        <div className="flex flex-wrap gap-2" aria-label={t('meals.ingredients')}>
          {bought.map((name) => (
            <Chip key={name} active={!usedUp.has(name)} onClick={() => toggle(name)}>
              <span className={usedUp.has(name) ? 'line-through' : ''}>{name}</span>
            </Chip>
          ))}
          {extras.map((name) => (
            <Chip key={`extra-${name}`} active label={t('meals.removeIngredient', { name })} onClick={() => setExtras(extras.filter((e) => e !== name))}>
              {name} <X size={12} className="ml-0.5 inline" aria-hidden />
            </Chip>
          ))}
          {bought.length === 0 && extras.length === 0 && planned.length === 0 && (
            <p className="text-sm text-muted">{t('meals.nothing')}</p>
          )}
        </div>
        {planned.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted">{t('meals.onList')}</h2>
            <div className="flex flex-wrap gap-2" aria-label={t('meals.onList')}>
              {planned.map((name) => (
                <Chip key={`list-${name}`} active={!usedUp.has(name)} onClick={() => toggle(name)}>
                  <span className={usedUp.has(name) ? 'line-through' : ''}>{name}</span>
                </Chip>
              ))}
            </div>
          </>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = extra.trim();
            if (name && !available.some((a) => a.toLowerCase() === name.toLowerCase())) setExtras([...extras, name]);
            setExtra('');
          }}
        >
          <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={t('meals.extraPlaceholder')} className={inputClass} aria-label={t('meals.extra')} />
          <button type="submit" className={ghostButton} aria-label={t('meals.addIngredient')} disabled={!extra.trim()}>
            <Plus size={18} />
          </button>
        </form>
        <button onClick={() => void run()} disabled={busy || !online || available.length < MIN_INGREDIENTS} className={`${primaryButton} py-3 text-lg`}>
          {busy ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
          {busy ? t('meals.thinking') : t('meals.suggest')}
        </button>
        {available.length < MIN_INGREDIENTS && <p className="text-sm text-muted">{t('meals.needs', { count: MIN_INGREDIENTS })}</p>}
        {!online && !error && <ErrorNotice error={friendlyError(new Error('offline'), 'meals', false)} />}
        {error && <ErrorNotice error={error} retrying={busy} onRetry={online ? () => void run() : undefined} />}
        {dropped.length > 0 && (
          <p className="text-sm text-muted" role="status">
            {t('meals.leftOut', { count: dropped.length, ideas: dropped.map((d) => `${d.name} (${d.reason})`).join('; ') })}
          </p>
        )}
      </section>
      )}

      <WeekPlan days={planWeek} plan={plan} onUnplan={readOnly ? undefined : (day, type) => onUnplan(day, type).catch((e: unknown) => setSaveError(friendlyError(e, 'save')))} />

      {shown && (
        <section className="grid gap-4" aria-label={t('meals.ideas')}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <select
                value={shown.id}
                onChange={(e) => setSelectedId(e.target.value)}
                className={inputClass}
                aria-label={t('meals.saved')}
              >
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {t('meals.savedOption', {
                      when: new Date(m.createdAt).toLocaleString(getLocale(), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
                      who: m.createdBy,
                      count: m.meals.length,
                    })}
                  </option>
                ))}
              </select>
            </div>
            {!readOnly && (
              <button onClick={() => onDelete(shown.id)} className={`${ghostButton} text-stone-400`} aria-label={t('meals.deleteIdeas')}>
                <Trash2 size={18} />
              </button>
            )}
          </div>
          {groupMeals(shown.meals, reflux).map(([type, meals]) => (
            <div key={type}>
              <h2 className="mb-2 text-sm font-semibold tracking-wider text-muted uppercase">{mealLabel(type)}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{meals.map((meal) => card(meal, meal.name))}</div>
            </div>
          ))}
        </section>
      )}

      {saveError && <ErrorNotice error={saveError} />}

      {favorites.length > 0 && (
        <section className="grid gap-3" aria-label={t('meals.favorites')}>
          <h2>
            <button
              onClick={() => setFavoritesOpen(!favoritesOpen)}
              aria-expanded={favoritesOpen}
              className="flex w-full items-center gap-2 text-left text-sm font-semibold tracking-wider text-muted uppercase"
            >
              <Star size={16} className="fill-terracotta text-terracotta" /> {t('meals.favoritesCount', { count: favorites.length })}
              <ChevronDown size={16} className={`ml-auto transition ${favoritesOpen ? 'rotate-180' : ''}`} />
            </button>
          </h2>
          {favoritesOpen && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{favorites.map((f) => card(f.meal, f.id, mealLabel(f.meal.type)))}</div>
          )}
        </section>
      )}

      {adding && groceries && (
        <AddIngredientsDialog
          meal={adding}
          list={groceries}
          onList={items.filter((i) => i.listId === groceries.id && !i.completed).map((i) => i.name)}
          // Used-up chips are not in the kitchen any more, so they are worth buying again.
          recentlyBought={bought.filter((b) => !usedUp.has(b))}
          pantry={pantry}
          onAdd={(names) => {
            onAddItems(groceries.id, names, t('meals.forMeal', { meal: mealName(adding) }));
            setNotice(t('meals.addedTo', { count: names.length, list: listName(groceries) }));
            setAdding(null);
          }}
          onClose={() => setAdding(null)}
        />
      )}

      {planning && (
        <PlanDialog
          meal={planning}
          days={planWeek}
          plan={plan}
          onPlan={(day, type) => {
            const meal = planning;
            setPlanning(null);
            onPlan(day, type, meal)
              .then(() => setNotice(t('meals.planned', { day: dayName(day), meal: mealLabel(type).toLocaleLowerCase(getLocale()) })))
              .catch((e: unknown) => setSaveError(friendlyError(e, 'save')));
          }}
          onClose={() => setPlanning(null)}
        />
      )}

      {notice && (
        <p
          role="status"
          className="fixed inset-x-0 bottom-[calc(1rem+max(var(--hh-bottom-nav),env(safe-area-inset-bottom)))] z-40 mx-auto w-fit rounded-full bg-forest-700 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-forest-300 dark:text-forest-900"
        >
          {notice}
        </p>
      )}
    </div>
  );
}

function MealCard({
  meal,
  label,
  saved,
  listName,
  sources,
  reflux,
  onToggleSaved,
  onAdd,
  onPlan,
  onAddExtras,
}: {
  meal: Meal;
  /** Shown above the name where the meal type is not already a heading. */
  label?: string;
  saved: boolean;
  listName?: string;
  /** The meal's ingredients by where they come from. */
  sources: Record<'have' | 'list' | 'extra', string[]>;
  /** Someone in the household has GERD: mark the meals that are easy on it. */
  reflux: boolean;
  /** Absent for helpers and kids, who see favourites but don't change them. */
  onToggleSaved?: () => void;
  onAdd: () => void;
  /** Absent for snacks, which are not planned. */
  onPlan?: () => void;
  onAddExtras: (names: string[]) => void;
}) {
  const t = useT();
  const name = mealName(meal);
  const row = (title: string, names: string[]) =>
    names.length > 0 && (
      <p>
        <span className="font-medium text-ink-soft">{title}:</span> {names.join(', ')}
      </p>
    );
  const iconButton = 'shrink-0 rounded-lg p-1.5 hover:bg-stone-100 dark:hover:bg-forest-700';
  return (
    <article className="rounded-2xl border border-stone-200 bg-surface p-4 dark:border-forest-700">
      <div className="mb-2 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          {label && <p className="text-xs font-semibold tracking-wider text-muted uppercase">{label}</p>}
          <h3 className="font-semibold">{name}</h3>
        </div>
        {onToggleSaved && (
          <button
            onClick={onToggleSaved}
            aria-pressed={saved}
            aria-label={saved ? t('meals.unsaveMeal', { meal: name }) : t('meals.saveMeal', { meal: name })}
            title={saved ? t('meals.unsave') : t('meals.save')}
            className={`${iconButton} ${saved ? 'text-terracotta' : 'text-stone-400'}`}
          >
            <Star size={18} className={saved ? 'fill-current' : ''} />
          </button>
        )}
        {onPlan && (
          <button onClick={onPlan} aria-label={t('meals.planMeal', { meal: name })} title={t('meals.planHint')} className={`${iconButton} text-stone-400`}>
            <CalendarPlus size={18} />
          </button>
        )}
        {listName && (
          <button
            onClick={onAdd}
            aria-label={t('meals.addIngredientsFor', { meal: name, list: listName })}
            title={t('meals.addIngredientsTo', { list: listName })}
            className={`${iconButton} text-stone-400`}
          >
            <ListPlus size={18} />
          </button>
        )}
      </div>
      <MealBadges meal={meal} reflux={reflux} />
      <div className="mb-2 grid gap-0.5 text-sm text-muted">
        {row(t('meals.have'), sources.have)}
        {row(t('meals.onList'), sources.list)}
        {sources.extra.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2">
            {row(t('meals.toGet'), sources.extra)}
            {listName && (
              <button
                onClick={() => onAddExtras(sources.extra)}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 font-medium text-link hover:bg-tint"
                aria-label={t('meals.addExtras', { items: formatList(sources.extra), list: listName })}
              >
                <ListPlus size={16} /> {t('meals.addToList')}
              </button>
            )}
          </div>
        )}
      </div>
      <ul className="grid gap-1.5 text-sm">
        {meal.parts.map((part, i) => (
          <li key={i}>
            <span className="font-medium">{sentenceCase(part.ingredients.join(', '))}</span>
            <span className="text-muted"> · {mealPrep(meal, i)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** "Today", "Tomorrow", "Wed, Jan 8" ("Mié, 8 ene"), from the kit's day helpers. */
function dayName(day: Ymd, now: number = Date.now()): string {
  const ahead = daysBetween(toYmd(now), day);
  if (ahead === 0 || ahead === 1) return relativeDay(ymdToTime(day), now);
  return capitalize(formatDayShort(ymdToTime(day)));
}

/** The day mid-sentence: "today", "tomorrow" lowercase; a date as `dayName`. */
function dayInline(day: Ymd, now: number = Date.now()): string {
  const ahead = daysBetween(toYmd(now), day);
  return ahead === 0 || ahead === 1 ? dayName(day, now).toLocaleLowerCase(getLocale()) : dayName(day, now);
}

/**
 * The week ahead, shared with the household: each day's breakfast, lunch and dinner. Empty slots
 * stay quiet; ideas are planned from their cards. Planned dinners also show in the portal.
 */
function WeekPlan({ days, plan, onUnplan }: { days: Ymd[]; plan: PlannedMeal[]; onUnplan?: (day: Ymd, type: PlanType) => Promise<void> }) {
  if (plan.length === 0) {
    return (
      <section aria-label={t('meals.week')} className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
        <h2 className="mb-1 font-semibold text-ink-soft">{t('meals.week')}</h2>
        {t('meals.weekEmpty')}
      </section>
    );
  }
  const slot = (day: Ymd, type: PlanType) => {
    const p = plan.find((x) => x.day === day && x.type === type);
    if (!p) return <span className="text-muted" aria-label={t('meals.nothingPlanned')}>–</span>;
    return (
      <span className="flex items-center gap-1">
        <span className="min-w-0 flex-1">{mealName({ name: p.name, local: p.meal?.local })}</span>
        {onUnplan && (
          <button
            onClick={() => void onUnplan(day, type)}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-forest-700"
            aria-label={t('meals.unplan', { meal: mealName({ name: p.name, local: p.meal?.local }), day: dayName(day), slot: mealLabel(type).toLocaleLowerCase(getLocale()) })}
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </span>
    );
  };
  return (
    <section aria-label={t('meals.week')} className="grid gap-2">
      <h2 className="text-sm font-semibold tracking-wider text-muted uppercase">{t('meals.week')}</h2>
      {/* Tablet and up: a table, days down, meals across. */}
      <table className="hidden w-full table-fixed overflow-hidden rounded-2xl border border-stone-200 bg-surface text-left text-sm sm:table dark:border-forest-700">
        <caption className="sr-only">{t('meals.week')}</caption>
        <thead className="text-muted">
          <tr>
            <th scope="col" className="w-36 px-3 py-2 font-medium">
              <span className="sr-only">{t('meals.day')}</span>
            </th>
            {PLAN_TYPES.map((type) => (
              <th key={type} scope="col" className="px-3 py-2 font-medium">
                {mealLabel(type)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day} className="border-t border-stone-200 dark:border-forest-700">
              <th scope="row" className="px-3 py-2 font-semibold">
                {dayName(day)}
              </th>
              {PLAN_TYPES.map((type) => (
                <td key={type} className="px-3 py-1 align-middle">
                  {slot(day, type)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Phone: one card per day with something planned. */}
      <ul className="grid gap-2 sm:hidden">
        {days
          .filter((day) => plan.some((p) => p.day === day))
          .map((day) => (
            <li key={day} className="rounded-2xl border border-stone-200 bg-surface p-3 dark:border-forest-700">
              <h3 className="mb-1 text-sm font-semibold">{dayName(day)}</h3>
              <dl className="grid gap-1 text-sm">
                {PLAN_TYPES.filter((type) => plan.some((p) => p.day === day && p.type === type)).map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <dt className="w-20 shrink-0 text-muted">{mealLabel(type)}</dt>
                    <dd className="min-w-0 flex-1">{slot(day, type)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
      </ul>
    </section>
  );
}

/** Picks the day and meal for an idea; defaults to its own type on the first free day. */
function PlanDialog({ meal, days, plan, onPlan, onClose }: { meal: Meal; days: Ymd[]; plan: PlannedMeal[]; onPlan: (day: Ymd, type: PlanType) => void; onClose: () => void }) {
  const initialType: PlanType = (PLAN_TYPES as readonly string[]).includes(meal.type) ? (meal.type as PlanType) : 'dinner';
  const [type, setType] = useState<PlanType>(initialType);
  const [day, setDay] = useState<Ymd>(() => firstFreeDay(days, plan, initialType));
  const taken = plan.find((p) => p.day === day && p.type === type);
  return (
    <Dialog title={t('meals.planMeal', { meal: mealName(meal) })} onClose={onClose}>
      <div className="grid gap-3">
        <div role="group" aria-label={t('meals.meal')} className="flex flex-wrap gap-2">
          {PLAN_TYPES.map((pt) => (
            <Chip key={pt} active={type === pt} onClick={() => setType(pt)}>
              {mealLabel(pt)}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label={t('meals.day')} className="flex flex-wrap gap-2">
          {days.map((d) => (
            <Chip key={d} active={day === d} onClick={() => setDay(d)}>
              {dayName(d)}
            </Chip>
          ))}
        </div>
        {taken && <p className="text-sm text-muted">{t('meals.replaces', { meal: mealName({ name: taken.name, local: taken.meal?.local }) })}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <button onClick={onClose} className={ghostButton}>
            {t('common.cancel')}
          </button>
          <button onClick={() => onPlan(day, type)} className={primaryButton}>
            {t('meals.planFor', { day: dayInline(day) })}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** "Alex (vegetarian, pregnant)", or with `possessive`, "Alex's GERD (reflux)": who has which diets. */
function whoHas(people: FoodPreferences['people'], keep: (d: FoodPreferences['people'][number]['diets'][number]) => boolean, possessive = false): string[] {
  return people
    .map((p) => ({ name: p.name, diets: p.diets.filter(keep).map((d) => dietLabel(d)) }))
    .filter((p) => p.diets.length)
    .map((p) =>
      possessive
        ? t('meals.whoPossessive', { name: p.name, diets: formatList(p.diets) })
        : t('diet.who', { name: p.name, diet: formatList(p.diets.map((d) => d.toLowerCase())) }),
    );
}

/** One wording for what is shown and what is read out. */
const HEAT_WORDS = ['level.heat1', 'level.heat2', 'level.heat3'] as const;

const LEVEL_WORDS = {
  acidity: ['level.acidity1', 'level.acidity2', 'level.acidity3'],
  richness: ['level.richness1', 'level.richness2', 'level.richness3'],
  sweetness: ['level.sweetness1', 'level.sweetness2', 'level.sweetness3'],
} as const satisfies Record<Exclude<keyof MealLevels, 'heat'>, readonly [string, string, string]>;

/**
 * What a menu would print beside a dish: Vegetarian or Vegan, flames for heat, and words for
 * acidity, richness and sweetness when there is any. Quiet stone text throughout.
 */
function MealBadges({ meal, reflux }: { meal: Meal; reflux: boolean }) {
  const levels = meal.levels ?? mealLevels(meal);
  const tags = dietTags(meal);
  const icons = { acidity: Citrus, richness: Droplet, sweetness: Candy } as const;
  const words = (Object.keys(LEVEL_WORDS) as (keyof typeof LEVEL_WORDS)[]).filter((k) => levels[k] > 0);
  const heatKey = HEAT_WORDS[levels.heat - 1];
  const heat = heatKey ? t(heatKey) : undefined;
  if (!tags.length && !levels.heat && !words.length && !reflux) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5" aria-label={t('meals.about', { meal: mealName(meal) })}>
      {reflux && gentleOnReflux(levels) && <Badge tone="forest">{t('level.gentle')}</Badge>}
      {tags.map((tag) => (
        <Badge key={tag}>
          <Leaf size={12} aria-hidden /> {tag}
        </Badge>
      ))}
      {heat && (
        <Badge label={heat}>
          {Array.from({ length: levels.heat }, (_, i) => (
            <Flame key={i} size={12} aria-hidden />
          ))}
          <span aria-hidden>{heat}</span>
        </Badge>
      )}
      {words.map((k) => {
        const Icon = icons[k];
        return (
          <Badge key={k}>
            <Icon size={12} aria-hidden /> {t(LEVEL_WORDS[k][Math.min(levels[k], 3) - 1])}
          </Badge>
        );
      })}
    </ul>
  );
}

/** "chicken, rice" → "Chicken, rice": sentence case, as the rest of the app writes. */
function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function AddIngredientsDialog({
  meal,
  list,
  onList,
  recentlyBought,
  pantry,
  onAdd,
  onClose,
}: {
  meal: Meal;
  list: ShoppingList;
  onList: string[];
  recentlyBought: string[];
  pantry: readonly string[];
  onAdd: (names: string[]) => void;
  onClose: () => void;
}) {
  // Computed once on open, so the ticks don't shift if the list changes while choosing. What is
  // neither listed nor bought is ticked.
  const t = useT();
  const [choices, setChoices] = useState(() => {
    const s = mealIngredients(meal, { have: recentlyBought, onList, pantry });
    return [
      ...s.extra.map((name) => ({ name, selected: true, note: null as 'meals.noteOnList' | 'meals.noteBought' | null })),
      ...s.list.map((name) => ({ name, selected: false, note: 'meals.noteOnList' as const })),
      ...s.have.map((name) => ({ name, selected: false, note: 'meals.noteBought' as const })),
    ];
  });
  const idPrefix = useId();
  const picked = choices.filter((c) => c.selected).map((c) => c.name);
  return (
    <Dialog title={t('googleTasks.addTo', { list: listName(list) })} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">{t('meals.forMealTitle', { meal: mealName(meal) })}</p>
      {choices.length === 0 ? (
        <p className="text-sm text-muted">{t('meals.onlyBasics')}</p>
      ) : (
        <ul className="grid gap-1">
          {choices.map((c, i) => (
            <li key={c.name} className="flex items-center gap-2 rounded-xl px-2 hover:bg-sunken">
              <label className="flex flex-1 items-center gap-3 py-2">
                <input
                  type="checkbox"
                  checked={c.selected}
                  onChange={() => setChoices(choices.map((x, j) => (j === i ? { ...x, selected: !x.selected } : x)))}
                  aria-describedby={c.note ? `${idPrefix}-${i}` : undefined}
                  className="h-5 w-5 shrink-0 accent-forest-700 dark:accent-forest-400"
                />
                {c.name}
              </label>
              {c.note && (
                <span id={`${idPrefix}-${i}`} className="text-xs text-muted">
                  {t(c.note)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className={ghostButton}>
          {t('common.cancel')}
        </button>
        <button onClick={() => onAdd(picked)} disabled={picked.length === 0} className={primaryButton}>
          {t('meals.addItems', { count: picked.length })}
        </button>
      </div>
    </Dialog>
  );
}
