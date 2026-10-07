/* ============================================================================
   Supplements. A tick list for today plus a 14-day strip per item.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Check, Pill, Plus, Trash2 } from 'lucide-react'
import type { Supplement } from '../lib/types'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtWeekday, lastNDays, today } from '../lib/date'
import { HeatStrip } from '../components/charts'
import { ConfirmSheet, Empty, ScreenHeader, Sheet, useToast } from '../components/ui'

const COMMON = [
  { name: 'Whey protein', dosage: '1 scoop (30 g)' },
  { name: 'Creatine monohydrate', dosage: '5 g' },
  { name: 'Fish oil', dosage: '2 capsules' },
  { name: 'Vitamin D3', dosage: '1 capsule' },
  { name: 'Multivitamin', dosage: '1 tablet' },
]

export default function Supplements() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const date = today()

  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Supplement | null>(null)

  const active = data.supplements.filter((s) => !s.archived)
  const takenToday = data.supplementLog[date] ?? []
  const last14 = useMemo(() => lastNDays(14), [])

  return (
    <div className="shell">
      <ScreenHeader
        title={t('supp.title')}
        subtitle={active.length ? `${takenToday.length} of ${active.length} taken today` : undefined}
        back="/more"
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label={t('supp.new')}
            onClick={() => setCreating(true)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        }
      />

      {active.length === 0 ? (
        <Empty
          icon={<Pill size={26} aria-hidden="true" />}
          title={t('supp.empty')}
          body={t('supp.empty.body')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
              <Plus size={15} aria-hidden="true" />
              {t('supp.new')}
            </button>
          }
        />
      ) : (
        <ul className="sp-list" style={{ marginTop: 'var(--s-4)' }}>
          {active.map((s) => {
            const taken = takenToday.includes(s.id)
            const cells = last14.map((d) => {
              const on = (data.supplementLog[d] ?? []).includes(s.id)
              return { label: fmtWeekday(d, locale).slice(0, 1), ratio: on ? 1 : 0, empty: !on }
            })

            return (
              <li key={s.id}>
                <article className="card">
                  <div className="row">
                    <button
                      type="button"
                      className="sp-tick"
                      data-on={taken}
                      aria-pressed={taken}
                      aria-label={`${s.name}: ${taken ? 'taken' : 'not taken'} today`}
                      onClick={() => actions.toggleSupplement(s.id, date)}
                    >
                      {taken && <Check size={17} strokeWidth={3} aria-hidden="true" />}
                    </button>

                    <div className="grow">
                      <h2 className="sp-name">{s.name}</h2>
                      <p className="sp-meta num">
                        {s.dosage}
                        {s.timeOfDay && ` · ${s.timeOfDay}`}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete ${s.name}`}
                      onClick={() => setDeleting(s)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>

                  <div style={{ marginTop: 'var(--s-4)' }}>
                    <HeatStrip cells={cells} label={`${s.name}, last 14 days`} />
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {creating && <NewSupplementSheet onClose={() => setCreating(false)} />}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteSupplement(deleting.id)
          toast.show('Supplement deleted')
        }}
        title={`Delete ${deleting?.name ?? 'supplement'}?`}
        body="Its history is removed with it."
      />

      <style>{`
        .sp-list { display: flex; flex-direction: column; gap: var(--s-3); }
        .sp-tick {
          display: grid; place-items: center;
          width: 42px; height: 42px; flex: none;
          border-radius: 50%;
          border: 2px solid var(--hairline-strong);
          background: var(--surface-2);
          color: var(--text-on-ember);
          transition:
            background-color var(--t-fast) var(--ease-out),
            border-color var(--t-fast) var(--ease-out);
        }
        .sp-tick:hover { border-color: var(--ember); }
        .sp-tick[data-on='true'] { background: var(--kiln-4); border-color: var(--kiln-4); }
        .sp-name {
          font-size: var(--fs-base); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .sp-meta { font-size: var(--fs-tiny); color: var(--text-3); margin-top: 2px; }
      `}</style>
    </div>
  )
}

function NewSupplementSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const { actions } = useStore()
  const toast = useToast()

  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('')
  const [remind, setRemind] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function create() {
    if (!name.trim()) {
      setError('Give it a name.')
      return
    }
    actions.addSupplement({
      name: name.trim(),
      dosage: dosage.trim() || '1 serving',
      timeOfDay: timeOfDay.trim() || undefined,
      remind,
    })
    toast.show(`${name.trim()} added`, { tone: 'good' })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('supp.new')}
      tall
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={create}>
          {t('common.create')}
        </button>
      }
    >
      <div className="stack-4">
        <div>
          <span className="field__label">Common ones</span>
          <div className="chips" style={{ marginTop: 'var(--s-2)' }}>
            {COMMON.map((c) => (
              <button
                key={c.name}
                type="button"
                className="chip"
                onClick={() => {
                  setName(c.name)
                  setDosage(c.dosage)
                  setError(null)
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

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
            placeholder="Creatine monohydrate"
            aria-invalid={!!error}
            maxLength={40}
          />
          {error && (
            <span className="field__error" role="alert">
              {error}
            </span>
          )}
        </label>

        <label className="field">
          <span className="field__label">{t('supp.dosage')}</span>
          <input
            className="input"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="5 g"
            maxLength={32}
          />
        </label>

        <label className="field">
          <span className="field__label">{t('supp.time')}</span>
          <input
            className="input"
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value)}
            placeholder="After breakfast"
            maxLength={32}
          />
          <span className="field__hint">Optional. Just a label — it does not schedule anything.</span>
        </label>

        <label className="sp-remind">
          <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          <span>
            <span className="sp-remindLabel">{t('supp.remind')}</span>
            <span className="sp-remindHint">
              Needs reminders turned on in Settings before it does anything
            </span>
          </span>
        </label>
      </div>

      <style>{`
        .sp-remind {
          display: flex; align-items: flex-start; gap: var(--s-3);
          min-height: 48px; cursor: pointer;
        }
        .sp-remind input { width: 19px; height: 19px; margin-top: 2px; accent-color: var(--ember); }
        .sp-remindLabel { display: block; font-size: var(--fs-sm); font-weight: 600; }
        .sp-remindHint { display: block; font-size: var(--fs-tiny); color: var(--text-3); }
      `}</style>
    </Sheet>
  )
}
