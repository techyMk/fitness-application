/* ============================================================================
   Saved meals. The one-tap path (spec §10) — "My Breakfast" adds eggs, oats,
   milk and a banana in a single action.
   ========================================================================= */

import { useState } from 'react'
import { BookmarkPlus, Plus, Trash2 } from 'lucide-react'
import type { MealType, SavedMeal } from '../lib/types'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { today } from '../lib/date'
import { ConfirmSheet, Empty, ScreenHeader, Sheet, useToast } from '../components/ui'

const MEALS: MealType[] = ['breakfast', 'lunch', 'snacks', 'dinner', 'other']

export default function SavedMeals() {
  const { t } = useT()
  const { data, actions } = useStore()
  const toast = useToast()

  const [adding, setAdding] = useState<SavedMeal | null>(null)
  const [deleting, setDeleting] = useState<SavedMeal | null>(null)

  const totalsOf = (m: SavedMeal) => ({
    calories: Math.round(m.items.reduce((a, i) => a + i.calories * i.qty, 0)),
    protein: Math.round(m.items.reduce((a, i) => a + i.protein * i.qty, 0)),
    carbs: Math.round(m.items.reduce((a, i) => a + i.carbs * i.qty, 0)),
    fat: Math.round(m.items.reduce((a, i) => a + i.fat * i.qty, 0)),
  })

  return (
    <div className="shell">
      <ScreenHeader title={t('nutri.savedMeals')} back="/nutrition" />

      {data.savedMeals.length === 0 ? (
        <Empty
          icon={<BookmarkPlus size={26} aria-hidden="true" />}
          title="No saved meals yet"
          body="Log a meal with a few items in Nutrition, then tap “Save as a meal” underneath it. After that it is one tap."
        />
      ) : (
        <ul className="sm-list" style={{ marginTop: 'var(--s-4)' }}>
          {data.savedMeals.map((m) => {
            const totals = totalsOf(m)
            return (
              <li key={m.id}>
                <article className="card">
                  <div className="row row--between">
                    <div className="grow">
                      <h2 className="sm-name">{m.name}</h2>
                      <p className="sm-slot">{t(`nutri.${m.type}`)}</p>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete ${m.name}`}
                      onClick={() => setDeleting(m)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>

                  <ul className="sm-items">
                    {m.items.map((i) => (
                      <li key={i.id} className="sm-item">
                        <span className="grow truncate">
                          {i.qty !== 1 && <span className="num">{i.qty} × </span>}
                          {i.name}
                        </span>
                        <span className="num sm-itemKcal">
                          {Math.round(i.calories * i.qty)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="sm-totals num">
                    <span>{totals.calories} kcal</span>
                    <span className="sm-sep" aria-hidden="true">·</span>
                    <span style={{ color: 'var(--series-1)' }}>{totals.protein}g P</span>
                    <span className="sm-sep" aria-hidden="true">·</span>
                    <span style={{ color: 'var(--series-2)' }}>{totals.carbs}g C</span>
                    <span className="sm-sep" aria-hidden="true">·</span>
                    <span style={{ color: 'var(--series-3)' }}>{totals.fat}g F</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn--primary btn--block"
                    onClick={() => setAdding(m)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add to today
                  </button>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {/* Which slot to add it to — defaults to the slot it was saved from. */}
      {adding && (
        <Sheet open onClose={() => setAdding(null)} title={`Add ${adding.name}`}>
          <p className="field__label">Which meal?</p>
          <div className="chips" style={{ marginTop: 'var(--s-2)' }}>
            {MEALS.map((type) => (
              <button
                key={type}
                type="button"
                className="chip"
                aria-pressed={type === adding.type}
                onClick={() => {
                  actions.addMealItems(
                    today(),
                    type,
                    adding.items.map((i) => ({ ...i, id: `${i.id}-${Date.now()}` })),
                  )
                  toast.show(`${adding.name} added to ${t(`nutri.${type}`).toLowerCase()}`, {
                    tone: 'good',
                  })
                  setAdding(null)
                }}
              >
                {t(`nutri.${type}`)}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteSavedMeal(deleting.id)
          toast.show('Saved meal deleted')
        }}
        title={`Delete ${deleting?.name ?? 'meal'}?`}
        body="Meals you already logged from it stay in your history."
      />

      <style>{`
        .sm-list { display: flex; flex-direction: column; gap: var(--s-3); }
        .sm-name {
          font-size: var(--fs-lg); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .sm-slot {
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--ember); margin-top: 2px;
        }
        .sm-items {
          display: flex; flex-direction: column; gap: 1px;
          margin: var(--s-4) 0 var(--s-3);
        }
        .sm-item {
          display: flex; align-items: center; gap: var(--s-2);
          min-height: 32px;
          font-size: var(--fs-tiny); color: var(--text-2);
          border-bottom: 1px solid var(--hairline);
        }
        .sm-itemKcal { flex: none; color: var(--text-3); }
        .sm-totals {
          display: flex; align-items: center; gap: 6px;
          margin-bottom: var(--s-4);
          font-size: var(--fs-tiny); font-weight: 500;
        }
        .sm-sep { color: var(--text-3); }
      `}</style>
    </div>
  )
}
