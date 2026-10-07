/* ============================================================================
   Nutrition. The day's four meal slots, each one tap from adding food.

   Three entry paths, all reachable from the same sheet (spec §8):
     1. Search the food database
     2. Quick add — type calories and protein, nothing else
     3. Saved meals — one tap adds the whole thing

   Path 2 matters more than it looks: most days a user already knows roughly what
   they ate, and forcing them to find exact database rows is how food logging
   dies. Quick add keeps the streak alive on a bad day.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  Zap,
} from 'lucide-react'
import type { Food, FoodPortion, MealType } from '../lib/types'
import { dayTotals } from '../lib/calc'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtInt } from '../lib/units'
import { addDays, fmtDate, relativeDay, today } from '../lib/date'
import { SEED_FOODS, searchFoods } from '../data/foods'
import { MacroBar } from '../components/charts'
import { Empty, Meter, ScreenHeader, Sheet, Stepper, useToast } from '../components/ui'

const MEALS: MealType[] = ['breakfast', 'lunch', 'snacks', 'dinner', 'other']

export function Nutrition() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!

  const [date, setDate] = useState(today())
  const [addTo, setAddTo] = useState<MealType | null>(null)

  const totals = useMemo(() => dayTotals(data, date), [data, date])
  const dayMeals = useMemo(() => data.meals.filter((m) => m.date === date), [data.meals, date])
  const allFoods = useMemo(() => [...data.customFoods, ...SEED_FOODS], [data.customFoods])

  const rel = relativeDay(date)
  const dateLabel = rel === 'today' ? t('common.today') : rel === 'yesterday' ? t('common.yesterday') : fmtDate(date, locale)

  return (
    <div className="shell">
      <ScreenHeader
        title={t('nutri.title')}
        action={
          <Link to="/nutrition/saved" className="icon-btn" aria-label={t('nutri.savedMeals')}>
            <BookmarkPlus size={19} aria-hidden="true" />
          </Link>
        }
      />

      {/* ----------------------------- day switch -------------------------- */}
      <div className="nu-dayNav">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous day"
          onClick={() => setDate(addDays(date, -1))}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="nu-dayLabel">{dateLabel}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next day"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today()}
          style={{ opacity: date >= today() ? 0.3 : 1 }}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {/* ------------------------------ totals ----------------------------- */}
      <section className="card" aria-label="Day totals">
        <div className="nu-headline">
          <span className="num nu-kcal">{fmtInt(totals.calories, locale)}</span>
          <span className="nu-kcalOf">
            / {fmtInt(profile.targets.calories, locale)}
            <span className="t-unit"> kcal</span>
          </span>
        </div>
        <Meter
          value={totals.calories}
          max={profile.targets.calories}
          label={`Calories: ${totals.calories} of ${profile.targets.calories}`}
        />
        <p className="nu-remain">
          {profile.targets.calories - totals.calories > 0
            ? `${fmtInt(profile.targets.calories - totals.calories, locale)} kcal ${t('nutri.remaining')}`
            : `${fmtInt(totals.calories - profile.targets.calories, locale)} kcal ${t('nutri.over')}`}
        </p>

        <div className="nu-protein">
          <div className="row row--between">
            <span className="nu-pLabel">{t('nutri.protein')}</span>
            <span className="num nu-pVal">
              {totals.protein}
              <span className="dim"> / {profile.targets.protein}</span>
              <span className="t-unit"> g</span>
            </span>
          </div>
          <Meter
            value={totals.protein}
            max={profile.targets.protein}
            label={`Protein: ${totals.protein} of ${profile.targets.protein} grams`}
            showOver={false}
          />
        </div>

        <div style={{ marginTop: 'var(--s-4)' }}>
          <MacroBar protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />
        </div>
      </section>

      {/* ------------------------------ meals ------------------------------ */}
      {MEALS.map((type) => {
        const meal = dayMeals.find((m) => m.type === type)
        const items = meal?.items ?? []
        const kcal = items.reduce((a, i) => a + i.calories * i.qty, 0)
        const protein = items.reduce((a, i) => a + i.protein * i.qty, 0)

        return (
          <section key={type} className="nu-meal" aria-labelledby={`nu-${type}`}>
            <div className="eyebrow">
              <span id={`nu-${type}`}>{t(`nutri.${type}`)}</span>
              {items.length > 0 && (
                <span className="eyebrow__action num">
                  {Math.round(kcal)} kcal · {Math.round(protein)}g P
                </span>
              )}
            </div>

            <div className="card card--flush">
              {items.length > 0 && (
                <ul>
                  {items.map((item) => (
                    <li key={item.id} className="nu-item">
                      <div className="grow">
                        <p className="nu-itemName truncate">{item.name}</p>
                        <p className="nu-itemServe">
                          {item.qty !== 1 && <span className="num">{item.qty} × </span>}
                          {item.serving}
                        </p>
                      </div>
                      <div className="nu-itemNums">
                        <span className="num nu-itemKcal">
                          {Math.round(item.calories * item.qty)}
                        </span>
                        <span className="num nu-itemP">
                          {Math.round(item.protein * item.qty)}g P
                        </span>
                      </div>
                      <button
                        type="button"
                        className="nu-del"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => {
                          actions.removeMealItem(meal!.id, item.id)
                          toast.show(`${item.name} removed`, {
                            action: {
                              label: t('common.undo'),
                              run: () => actions.addMealItems(date, type, [item]),
                            },
                          })
                        }}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button type="button" className="nu-add pressable" onClick={() => setAddTo(type)}>
                <Plus size={16} aria-hidden="true" />
                {t('nutri.addFood')}
              </button>
            </div>

            {items.length > 1 && (
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => {
                  actions.saveMeal({ name: `My ${t(`nutri.${type}`).toLowerCase()}`, type, items })
                  toast.show('Saved. Add it in one tap next time.', { tone: 'good' })
                }}
              >
                <BookmarkPlus size={14} aria-hidden="true" />
                {t('nutri.saveAsMeal')}
              </button>
            )}
          </section>
        )
      })}

      {addTo && (
        <AddFoodSheet
          mealType={addTo}
          date={date}
          foods={allFoods}
          onClose={() => setAddTo(null)}
        />
      )}

      <style>{`
        .nu-dayNav {
          display: flex; align-items: center; justify-content: center;
          gap: var(--s-2); padding: var(--s-3) 0;
        }
        .nu-dayLabel {
          min-width: 9rem; text-align: center;
          font-family: var(--font-display);
          font-size: var(--fs-sm); font-weight: 700;
          letter-spacing: 0.04em;
        }

        .nu-headline { display: flex; align-items: baseline; gap: var(--s-2); margin-bottom: var(--s-3); }
        .nu-kcal {
          font-size: var(--fs-4xl); font-weight: 600; line-height: 1;
          letter-spacing: -0.03em;
        }
        .nu-kcalOf { font-size: var(--fs-base); color: var(--text-3); }
        .nu-remain { margin-top: var(--s-2); font-size: var(--fs-tiny); color: var(--text-3); }

        .nu-protein { margin-top: var(--s-5); }
        .nu-pLabel { font-size: var(--fs-sm); font-weight: 600; color: var(--text-2); margin-bottom: 5px; }
        .nu-pVal { font-size: var(--fs-sm); font-weight: 600; margin-bottom: 5px; }

        .nu-item {
          display: flex; align-items: center; gap: var(--s-3);
          padding: var(--s-3) var(--s-2) var(--s-3) var(--s-4);
          border-bottom: 1px solid var(--hairline);
        }
        .nu-itemName { font-size: var(--fs-sm); font-weight: 600; }
        .nu-itemServe { font-size: var(--fs-tiny); color: var(--text-3); }
        .nu-itemNums {
          display: flex; flex-direction: column; align-items: flex-end;
          flex: none;
        }
        .nu-itemKcal { font-size: var(--fs-sm); font-weight: 600; }
        .nu-itemP { font-size: var(--fs-micro); color: var(--series-1); }
        .nu-del {
          display: grid; place-items: center;
          width: 36px; height: 36px; flex: none;
          border-radius: var(--r-sm); color: var(--text-3);
        }
        .nu-del:hover { background: var(--critical-soft); color: var(--critical); }

        .nu-add {
          display: flex; align-items: center; justify-content: center;
          gap: var(--s-2); width: 100%; min-height: 52px;
          font-family: var(--font-display);
          font-size: var(--fs-tiny); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--ember);
        }
      `}</style>
    </div>
  )
}

/* ========================== add-food sheet =============================== */

type Tab = 'search' | 'quick' | 'saved'

function AddFoodSheet({
  mealType,
  date,
  foods,
  onClose,
}: {
  mealType: MealType
  date: string
  foods: Food[]
  onClose: () => void
}) {
  const { t } = useT()
  const { data, actions } = useStore()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('search')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Food | null>(null)
  const [creating, setCreating] = useState(false)

  const results = useMemo(() => searchFoods(foods, query, 50), [foods, query])

  function add(items: FoodPortion[], label: string) {
    actions.addMealItems(date, mealType, items)
    toast.show(label, { tone: 'good' })
    onClose()
  }

  if (picked) {
    return (
      <PortionSheet
        food={picked}
        onBack={() => setPicked(null)}
        onAdd={(portion) => add([portion], `${picked.name} added`)}
      />
    )
  }

  if (creating) {
    return (
      <CreateFoodSheet
        onBack={() => setCreating(false)}
        onCreated={(food) => {
          setCreating(false)
          setPicked(food)
        }}
      />
    )
  }

  return (
    <Sheet open onClose={onClose} title={`${t('nutri.addFood')} · ${t(`nutri.${mealType}`)}`} tall>
      <div className="segmented" style={{ marginBottom: 'var(--s-4)' }}>
        <button type="button" aria-selected={tab === 'search'} onClick={() => setTab('search')}>
          {t('common.search')}
        </button>
        <button type="button" aria-selected={tab === 'quick'} onClick={() => setTab('quick')}>
          {t('nutri.quickAdd')}
        </button>
        <button type="button" aria-selected={tab === 'saved'} onClick={() => setTab('saved')}>
          {t('nutri.savedMeals')}
        </button>
      </div>

      {tab === 'search' && (
        <>
          <div className="af-search">
            <Search size={16} aria-hidden="true" />
            <input
              className="af-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Paneer, roti, whey…"
              aria-label={t('nutri.searchFood')}
            />
          </div>

          {results.length === 0 ? (
            <Empty
              title={t('nutri.noResults')}
              body={t('nutri.noResults.body')}
              action={
                <button type="button" className="btn btn--ghost" onClick={() => setCreating(true)}>
                  <Plus size={15} aria-hidden="true" />
                  {t('nutri.customFood')}
                </button>
              }
            />
          ) : (
            <ul className="af-list">
              {results.map((f) => (
                <li key={f.id}>
                  <button type="button" className="af-row pressable" onClick={() => setPicked(f)}>
                    <span className="grow">
                      <span className="af-name">
                        {f.name}
                        {f.custom && <span className="af-mine">yours</span>}
                      </span>
                      <span className="af-serve">{f.serving}</span>
                    </span>
                    <span className="af-nums">
                      <span className="num af-kcal">{f.calories}</span>
                      <span className="num af-p">{f.protein}g P</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="btn btn--quiet btn--block"
            style={{ marginTop: 'var(--s-3)' }}
            onClick={() => setCreating(true)}
          >
            <Plus size={15} aria-hidden="true" />
            {t('nutri.customFood')}
          </button>
        </>
      )}

      {tab === 'quick' && <QuickAdd onAdd={(p) => add([p], 'Added')} />}

      {tab === 'saved' && (
        <>
          {data.savedMeals.length === 0 ? (
            <Empty
              title="No saved meals yet"
              body="Log a meal with a few items, then tap “Save as a meal” underneath it."
            />
          ) : (
            <ul className="af-list">
              {data.savedMeals.map((m) => {
                const kcal = m.items.reduce((a, i) => a + i.calories * i.qty, 0)
                const protein = m.items.reduce((a, i) => a + i.protein * i.qty, 0)
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="af-row pressable"
                      onClick={() =>
                        add(
                          m.items.map((i) => ({ ...i, id: `${i.id}-${Date.now()}` })),
                          `${m.name} added`,
                        )
                      }
                    >
                      <span className="grow">
                        <span className="af-name">{m.name}</span>
                        <span className="af-serve truncate">
                          {m.items.map((i) => i.name).join(', ')}
                        </span>
                      </span>
                      <span className="af-nums">
                        <span className="num af-kcal">{Math.round(kcal)}</span>
                        <span className="num af-p">{Math.round(protein)}g P</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      <style>{`
        .af-search {
          display: flex; align-items: center; gap: var(--s-2);
          padding: 0 var(--s-3);
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
          color: var(--text-3);
        }
        .af-input {
          flex: 1; height: 48px; background: transparent; border: 0;
          font-size: var(--fs-base);
        }
        .af-input:focus { outline: none; }
        .af-list { display: flex; flex-direction: column; margin-top: var(--s-2); }
        .af-row {
          display: flex; align-items: center; gap: var(--s-3);
          width: 100%; min-height: 58px; padding: var(--s-2);
          border-bottom: 1px solid var(--hairline);
          border-radius: var(--r-sm);
          text-align: left;
        }
        .af-name {
          display: flex; align-items: center; gap: 6px;
          font-size: var(--fs-sm); font-weight: 600;
        }
        .af-mine {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--ember);
          padding: 1px 5px;
          background: var(--ember-soft);
          border-radius: 3px;
        }
        .af-serve { display: block; font-size: var(--fs-tiny); color: var(--text-3); }
        .af-nums {
          display: flex; flex-direction: column; align-items: flex-end; flex: none;
        }
        .af-kcal { font-size: var(--fs-sm); font-weight: 600; }
        .af-p { font-size: var(--fs-micro); color: var(--series-1); }
      `}</style>
    </Sheet>
  )
}

/* --------------------------- portion picker ------------------------------ */

function PortionSheet({
  food,
  onBack,
  onAdd,
}: {
  food: Food
  onBack: () => void
  onAdd: (p: FoodPortion) => void
}) {
  const { t } = useT()
  const [qty, setQty] = useState(1)

  const scaled = {
    calories: Math.round(food.calories * qty),
    protein: Math.round(food.protein * qty),
    carbs: Math.round(food.carbs * qty),
    fat: Math.round(food.fat * qty),
  }

  return (
    <Sheet
      open
      onClose={onBack}
      title={food.name}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block btn--lg"
          onClick={() =>
            onAdd({
              id: `fp-${Date.now()}`,
              foodId: food.id,
              name: food.name,
              serving: food.serving,
              qty,
              calories: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
            })
          }
        >
          <Plus size={16} aria-hidden="true" />
          {t('common.add')}
        </button>
      }
    >
      <button type="button" className="btn btn--quiet" onClick={onBack} style={{ marginBottom: 'var(--s-3)' }}>
        <ChevronLeft size={15} aria-hidden="true" />
        {t('common.back')}
      </button>

      <p className="ps-serving">{food.serving}</p>

      <Stepper
        label={t('nutri.qty')}
        value={qty}
        onChange={setQty}
        step={0.5}
        decimals={1}
        min={0.5}
        max={20}
      />

      <div className="grid-2" style={{ marginTop: 'var(--s-5)' }}>
        <MacroTile label={t('nutri.calories')} value={scaled.calories} unit="kcal" accent />
        <MacroTile label={t('nutri.protein')} value={scaled.protein} unit="g" />
        <MacroTile label={t('nutri.carbs')} value={scaled.carbs} unit="g" />
        <MacroTile label={t('nutri.fat')} value={scaled.fat} unit="g" />
      </div>

      <style>{`
        .ps-serving {
          font-size: var(--fs-sm); color: var(--text-2);
          margin-bottom: var(--s-4);
        }
      `}</style>
    </Sheet>
  )
}

function MacroTile({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: number
  unit: string
  accent?: boolean
}) {
  return (
    <div className="card card--inset" style={{ padding: 'var(--s-3)' }}>
      <span className="t-micro dim">{label}</span>
      <p
        className="num"
        style={{
          fontSize: 'var(--fs-xl)',
          fontWeight: 600,
          marginTop: 2,
          color: accent ? 'var(--ember)' : undefined,
        }}
      >
        {value}
        <span className="t-unit"> {unit}</span>
      </p>
    </div>
  )
}

/* ----------------------------- quick add -------------------------------- */

function QuickAdd({ onAdd }: { onAdd: (p: FoodPortion) => void }) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState(300)
  const [protein, setProtein] = useState(20)
  const [carbs, setCarbs] = useState(0)
  const [fat, setFat] = useState(0)

  return (
    <div className="stack-4">
      <p className="field__hint" style={{ marginTop: 0 }}>
        {t('nutri.quickAdd.hint')} Carbs and fat are optional — leave them at zero and the macro bar
        just shows less detail.
      </p>

      <label className="field">
        <span className="field__label">What was it?</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lunch at the canteen"
          maxLength={48}
        />
      </label>

      <div className="grid-2">
        <Stepper label={t('nutri.calories')} unit="kcal" step={25} min={0} max={5000} value={kcal} onChange={setKcal} />
        <Stepper label={t('nutri.protein')} unit="g" step={5} min={0} max={300} value={protein} onChange={setProtein} />
        <Stepper label={t('nutri.carbs')} unit="g" step={5} min={0} max={500} value={carbs} onChange={setCarbs} />
        <Stepper label={t('nutri.fat')} unit="g" step={5} min={0} max={300} value={fat} onChange={setFat} />
      </div>

      <button
        type="button"
        className="btn btn--primary btn--block btn--lg"
        onClick={() =>
          onAdd({
            id: `fp-${Date.now()}`,
            name: name.trim() || 'Quick add',
            serving: 'One serving',
            qty: 1,
            calories: kcal,
            protein,
            carbs,
            fat,
          })
        }
      >
        <Zap size={16} aria-hidden="true" />
        {t('common.add')}
      </button>
    </div>
  )
}

/* ---------------------------- create food ------------------------------- */

function CreateFoodSheet({
  onBack,
  onCreated,
}: {
  onBack: () => void
  onCreated: (f: Food) => void
}) {
  const { t } = useT()
  const { actions } = useStore()
  const [name, setName] = useState('')
  const [serving, setServing] = useState('')
  const [kcal, setKcal] = useState(100)
  const [protein, setProtein] = useState(10)
  const [carbs, setCarbs] = useState(10)
  const [fat, setFat] = useState(5)
  const [error, setError] = useState<string | null>(null)

  function create() {
    if (!name.trim()) {
      setError('Give the food a name so you can find it again.')
      return
    }
    const food = actions.addCustomFood({
      name: name.trim(),
      serving: serving.trim() || 'One serving',
      calories: kcal,
      protein,
      carbs,
      fat,
    })
    onCreated(food)
  }

  return (
    <Sheet
      open
      onClose={onBack}
      title={t('nutri.customFood')}
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={create}>
          {t('common.create')}
        </button>
      }
    >
      <div className="stack-4">
        <label className="field">
          <span className="field__label">
            Name<span className="field__req" aria-hidden="true">*</span>
          </span>
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="Amma's sambar"
            aria-invalid={!!error}
            maxLength={48}
          />
          {error && (
            <span className="field__error" role="alert">
              {error}
            </span>
          )}
        </label>

        <label className="field">
          <span className="field__label">{t('nutri.serving')}</span>
          <input
            className="input"
            value={serving}
            onChange={(e) => setServing(e.target.value)}
            placeholder="1 cup (200 g)"
            maxLength={32}
          />
          <span className="field__hint">
            Write it how you'd say it. The numbers below are for one of these.
          </span>
        </label>

        <div className="grid-2">
          <Stepper label={t('nutri.calories')} unit="kcal" step={10} min={0} max={2000} value={kcal} onChange={setKcal} />
          <Stepper label={t('nutri.protein')} unit="g" step={1} min={0} max={200} value={protein} onChange={setProtein} />
          <Stepper label={t('nutri.carbs')} unit="g" step={1} min={0} max={300} value={carbs} onChange={setCarbs} />
          <Stepper label={t('nutri.fat')} unit="g" step={1} min={0} max={200} value={fat} onChange={setFat} />
        </div>
      </div>
    </Sheet>
  )
}
