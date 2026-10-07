/* ============================================================================
   Personal records. Gym PRs per exercise, plus the non-gym records from §18
   (fastest 5K, longest cardio, highest steps, longest workout, most workouts in
   a month). All recomputed from history, never stored as a separate truth.
   ========================================================================= */

import { useMemo } from 'react'
import { Footprints, Timer, Trophy } from 'lucide-react'
import type { NonGymRecordKey } from '../lib/types'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { fmtInt, makeFmt } from '../lib/units'
import { fmtDate, fmtDuration } from '../lib/date'
import { SEED_EXERCISES, MUSCLE_LABELS } from '../data/exercises'
import { Empty, ScreenHeader } from '../components/ui'

const NON_GYM_LABELS: Record<NonGymRecordKey, string> = {
  'fastest-5k': 'Fastest 5 km',
  'longest-cardio': 'Longest cardio session',
  'highest-steps': 'Most steps in a day',
  'longest-workout': 'Longest workout',
  'best-week-consistency': 'Best week',
  'most-workouts-month': 'Most workouts in a month',
}

export default function Records() {
  const { t, locale } = useT()
  const { data } = useStore()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const exerciseById = useMemo(
    () => new Map([...SEED_EXERCISES, ...data.customExercises].map((e) => [e.id, e])),
    [data.customExercises],
  )

  // Sorted by estimated 1RM so the heaviest lifts lead — that is the reading a
  // lifter scans for.
  const gym = useMemo(
    () =>
      [...data.records]
        .map((r) => ({ record: r, exercise: exerciseById.get(r.exerciseId) }))
        .filter((x) => x.exercise)
        .sort((a, b) => b.record.best1rmKg - a.record.best1rmKg),
    [data.records, exerciseById],
  )

  const hasAny = gym.length > 0 || data.nonGymRecords.length > 0

  return (
    <div className="shell">
      <ScreenHeader title={t('pr.title')} back={true} />

      {!hasAny ? (
        <Empty
          icon={<Trophy size={26} aria-hidden="true" />}
          title={t('pr.empty')}
          body={t('pr.empty.body')}
        />
      ) : (
        <>
          {data.nonGymRecords.length > 0 && (
            <>
              <div className="eyebrow">{t('pr.other')}</div>
              <ul className="rc-other">
                {data.nonGymRecords.map((r) => (
                  <li key={r.key}>
                    <article className="card rc-otherCard">
                      <span className="rc-otherIcon">
                        {r.key === 'highest-steps' ? (
                          <Footprints size={15} aria-hidden="true" />
                        ) : (
                          <Timer size={15} aria-hidden="true" />
                        )}
                      </span>
                      <div className="grow">
                        <p className="rc-otherLabel">{NON_GYM_LABELS[r.key]}</p>
                        <p className="rc-otherDate num">{fmtDate(r.date, locale)}</p>
                      </div>
                      <span className="num rc-otherVal">
                        {r.label === 'min' ? fmtDuration(r.value) : fmtInt(r.value, locale)}
                        {r.label !== 'min' && <span className="t-unit"> {r.label}</span>}
                      </span>
                    </article>
                  </li>
                ))}
              </ul>
            </>
          )}

          {gym.length > 0 && (
            <>
              <div className="eyebrow">
                {t('pr.gym')}
                <span className="eyebrow__action num">{gym.length}</span>
              </div>
              <ul className="rc-list">
                {gym.map(({ record, exercise }) => (
                  <li key={record.id}>
                    <article className="card">
                      <div className="row row--between">
                        <div className="grow">
                          <h2 className="rc-name">{exercise!.name}</h2>
                          <p className="rc-muscle">{MUSCLE_LABELS[exercise!.muscle]}</p>
                        </div>
                      </div>

                      <div className="rc-figures">
                        <Figure
                          label={t('pr.heaviest')}
                          value={
                            exercise!.isBodyweight
                              ? `${record.bestWeightReps}`
                              : fmt.weight(record.bestWeightKg)
                          }
                          unit={exercise!.isBodyweight ? 'reps' : fmt.weightUnit}
                          sub={
                            exercise!.isBodyweight
                              ? fmtDate(record.bestWeightDate, locale)
                              : `× ${record.bestWeightReps} · ${fmtDate(record.bestWeightDate, locale)}`
                          }
                          hot
                        />
                        <Figure
                          label={t('pr.bestReps')}
                          value={String(record.bestReps)}
                          unit="reps"
                          sub={
                            exercise!.isBodyweight
                              ? fmtDate(record.bestRepsDate, locale)
                              : `at ${fmt.weight(record.bestRepsWeightKg)} ${fmt.weightUnit} · ${fmtDate(record.bestRepsDate, locale)}`
                          }
                        />
                        {!exercise!.isBodyweight && (
                          <Figure
                            label="Est. 1RM"
                            value={fmt.weight(record.best1rmKg)}
                            unit={fmt.weightUnit}
                            sub={fmtDate(record.best1rmDate, locale)}
                          />
                        )}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>

              <p className="rc-note">
                Estimated 1RM uses the Epley formula from your best set. It is a comparison tool, not
                a number to go and attempt.
              </p>
            </>
          )}
        </>
      )}

      <style>{`
        .rc-other { display: flex; flex-direction: column; gap: var(--s-2); }
        .rc-otherCard {
          display: flex; align-items: center; gap: var(--s-3);
          padding: var(--s-3) var(--s-4);
        }
        .rc-otherIcon {
          display: grid; place-items: center;
          width: 32px; height: 32px; flex: none;
          border-radius: var(--r-sm);
          background: var(--surface-2); color: var(--kiln-4);
        }
        .rc-otherLabel { font-size: var(--fs-sm); font-weight: 600; }
        .rc-otherDate { font-size: var(--fs-tiny); color: var(--text-3); }
        .rc-otherVal {
          flex: none; font-size: var(--fs-lg); font-weight: 600;
          color: var(--kiln-4);
        }

        .rc-list { display: flex; flex-direction: column; gap: var(--s-3); }
        .rc-name {
          font-size: var(--fs-base); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .rc-muscle {
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--text-3); margin-top: 2px;
        }
        .rc-figures {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
          gap: var(--s-3);
          margin-top: var(--s-4); padding-top: var(--s-3);
          border-top: 1px solid var(--hairline);
        }
        .rc-note {
          margin-top: var(--s-5);
          font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.5;
        }
      `}</style>
    </div>
  )
}

function Figure({
  label,
  value,
  unit,
  sub,
  hot,
}: {
  label: string
  value: string
  unit?: string
  sub: string
  hot?: boolean
}) {
  return (
    <div className="fig">
      <span className="t-micro fig__label">{label}</span>
      <span className="num fig__val" style={{ color: hot ? 'var(--kiln-5)' : undefined }}>
        {value}
        {unit && <span className="t-unit"> {unit}</span>}
      </span>
      <span className="fig__sub num">{sub}</span>

      <style>{`
        .fig { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .fig__label { color: var(--text-3); }
        .fig__val {
          font-size: var(--fs-lg); font-weight: 600; line-height: 1.1;
          display: flex; align-items: baseline; gap: 3px;
        }
        .fig__sub { font-size: 10px; color: var(--text-3); }
      `}</style>
    </div>
  )
}
