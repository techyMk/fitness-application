/* ============================================================================
   Workout hub. Today's session at the top (the thing you came here for), then
   programme, then history.
   ========================================================================= */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChevronRight,
  Dumbbell,
  History,
  Library,
  Play,
  Trophy,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { makeFmt, fmtInt } from '../lib/units'
import { fmtDate, fmtDuration, today } from '../lib/date'
import { isRestDay } from '../lib/calc'
import { SEED_EXERCISES } from '../data/exercises'
import { Empty, ScreenHeader, Sheet } from '../components/ui'

export function Workout() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const navigate = useNavigate()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])
  const date = today()

  const [freeSheet, setFreeSheet] = useState(false)
  const [freeTitle, setFreeTitle] = useState('')

  const plan = data.plans.find((p) => p.id === data.activePlanId)
  const weekday = new Date(`${date}T00:00:00`).getDay()
  const planDay = plan?.days.find((d) => d.weekday === weekday)
  const restDay = isRestDay(data, date)
  const liveSession = data.sessions.find((s) => !s.completed)
  const history = useMemo(
    () => data.sessions.filter((s) => s.completed).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.sessions],
  )

  const exerciseById = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of [...SEED_EXERCISES, ...data.customExercises]) map.set(e.id, e.name)
    return map
  }, [data.customExercises])

  function startPlanned() {
    if (liveSession) {
      navigate(`/workout/session/${liveSession.id}`)
      return
    }
    const title = planDay && !planDay.rest ? planDay.title : t('wk.freeSession')
    const session = actions.startSession(title, plan?.id, planDay?.weekday)
    navigate(`/workout/session/${session.id}`)
  }

  function startFree() {
    const session = actions.startSession(freeTitle.trim() || t('wk.freeSession'))
    setFreeSheet(false)
    setFreeTitle('')
    navigate(`/workout/session/${session.id}`)
  }

  return (
    <div className="shell">
      <ScreenHeader
        title={t('wk.title')}
        subtitle={plan ? plan.name : t('home.noPlan')}
        action={
          <Link to="/records" className="icon-btn" aria-label={t('pr.title')}>
            <Trophy size={19} aria-hidden="true" />
          </Link>
        }
      />

      {/* ------------------------- today's session ------------------------- */}
      <section className="card wk-today" style={{ marginTop: 'var(--s-4)' }}>
        <span className="t-micro dim">{t('wk.today')}</span>

        {liveSession ? (
          <>
            <h2 className="wk-todayTitle">{liveSession.title}</h2>
            <p className="wk-todayMeta">
              In progress · {liveSession.sets.filter((s) => s.done).length} sets logged
            </p>
            <button type="button" className="btn btn--primary btn--lg btn--block" onClick={startPlanned}>
              <Play size={17} aria-hidden="true" />
              {t('wk.resume')}
            </button>
          </>
        ) : restDay ? (
          <>
            <h2 className="wk-todayTitle">{t('home.restDay')}</h2>
            <p className="wk-todayMeta">{t('home.restDay.body')}</p>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setFreeSheet(true)}>
              <Dumbbell size={16} aria-hidden="true" />
              Train anyway
            </button>
          </>
        ) : (
          <>
            <h2 className="wk-todayTitle">{planDay?.title ?? t('wk.freeSession')}</h2>
            {planDay && planDay.exerciseIds.length > 0 ? (
              <ol className="wk-exList">
                {planDay.exerciseIds.map((id, i) => (
                  <li key={`${id}-${i}`} className="wk-exItem">
                    <span className="wk-exDot" aria-hidden="true" />
                    <span className="truncate">{exerciseById.get(id) ?? id}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="wk-todayMeta">
                No programme for today. Start a free session and add exercises as you go.
              </p>
            )}
            <button type="button" className="btn btn--primary btn--lg btn--block" onClick={startPlanned}>
              <Play size={17} aria-hidden="true" />
              {t('wk.start')}
            </button>
            <button
              type="button"
              className="btn btn--quiet btn--block"
              style={{ marginTop: 'var(--s-2)' }}
              onClick={() => setFreeSheet(true)}
            >
              Start something else
            </button>
          </>
        )}
      </section>

      {/* ----------------------------- shortcuts --------------------------- */}
      <div className="eyebrow">Programme</div>
      <div className="card card--flush">
        <NavRow
          to="/workout/plans"
          icon={<CalendarDays size={17} aria-hidden="true" />}
          title={t('wk.plans')}
          meta={plan ? `${t('wk.plan.active')}: ${plan.name}` : t('home.noPlan.body')}
        />
        <div className="divider" />
        <NavRow
          to="/workout/library"
          icon={<Library size={17} aria-hidden="true" />}
          title={t('wk.library')}
          meta={`${SEED_EXERCISES.length + data.customExercises.length} exercises`}
        />
        <div className="divider" />
        <NavRow
          to="/records"
          icon={<Trophy size={17} aria-hidden="true" />}
          title={t('pr.title')}
          meta={
            data.records.length
              ? `${data.records.length} tracked`
              : t('pr.empty.body')
          }
        />
      </div>

      {/* ------------------------------ history ---------------------------- */}
      <div className="eyebrow">
        {t('wk.history')}
        {history.length > 0 && <span className="eyebrow__action num">{history.length}</span>}
      </div>

      {history.length === 0 ? (
        <div className="card">
          <Empty
            icon={<History size={26} aria-hidden="true" />}
            title={t('wk.empty')}
            body={t('wk.empty.body')}
          />
        </div>
      ) : (
        <ul className="wk-hist">
          {history.slice(0, 25).map((s) => (
            <li key={s.id}>
              <div className="card wk-histRow">
                <div className="wk-histDate">
                  <span className="num wk-histDay">{fmtDate(s.date, locale).split(' ')[0]}</span>
                  <span className="t-micro dim">{fmtDate(s.date, locale).split(' ')[1]}</span>
                </div>
                <div className="grow">
                  <p className="wk-histTitle truncate">{s.title}</p>
                  <p className="wk-histMeta num">
                    {s.sets.length} sets · {fmtInt(s.volumeKg, locale)} {fmt.weightUnit}
                    {s.durationSec ? ` · ${fmtDuration(s.durationSec / 60)}` : ''}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ------------------------------ sheet ------------------------------ */}
      <Sheet
        open={freeSheet}
        onClose={() => setFreeSheet(false)}
        title="Start a session"
        footer={
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={startFree}>
            <Play size={16} aria-hidden="true" />
            {t('wk.start')}
          </button>
        }
      >
        <label className="field">
          <span className="field__label">What are you training?</span>
          <input
            className="input"
            value={freeTitle}
            onChange={(e) => setFreeTitle(e.target.value)}
            placeholder="Chest + Triceps"
            maxLength={48}
          />
          <span className="field__hint">Leave it blank and it saves as a free session.</span>
        </label>
      </Sheet>

      <style>{`
        .wk-today { display: flex; flex-direction: column; }
        .wk-todayTitle {
          margin: var(--s-2) 0;
          font-size: var(--fs-2xl); font-weight: 800;
          letter-spacing: var(--tr-display); line-height: 1.1;
        }
        .wk-todayMeta {
          font-size: var(--fs-sm); color: var(--text-2);
          margin-bottom: var(--s-4); max-width: 38ch;
        }
        .wk-exList {
          display: flex; flex-direction: column; gap: var(--s-2);
          margin-bottom: var(--s-5);
        }
        .wk-exItem {
          display: flex; align-items: center; gap: var(--s-3);
          font-size: var(--fs-sm); color: var(--text-2);
        }
        .wk-exDot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--kiln-3); flex: none;
        }

        .wk-hist { display: flex; flex-direction: column; gap: var(--s-2); }
        .wk-histRow {
          display: flex; align-items: center; gap: var(--s-4);
          padding: var(--s-3) var(--s-4);
        }
        .wk-histDate {
          display: flex; flex-direction: column; align-items: center;
          width: 34px; flex: none;
        }
        .wk-histDay {
          font-size: var(--fs-lg); font-weight: 600; line-height: 1;
        }
        .wk-histTitle { font-size: var(--fs-sm); font-weight: 600; }
        .wk-histMeta { font-size: var(--fs-tiny); color: var(--text-3); margin-top: 2px; }
      `}</style>
    </div>
  )
}

export function NavRow({
  to,
  icon,
  title,
  meta,
}: {
  to: string
  icon: React.ReactNode
  title: string
  meta?: string
}) {
  return (
    <Link to={to} className="navrow pressable">
      <span className="navrow__icon">{icon}</span>
      <span className="navrow__text">
        <span className="navrow__title">{title}</span>
        {meta && <span className="navrow__meta truncate">{meta}</span>}
      </span>
      <ChevronRight size={17} className="dim" aria-hidden="true" />

      <style>{`
        .navrow {
          display: flex; align-items: center; gap: var(--s-3);
          min-height: 60px; padding: var(--s-2) var(--s-4);
        }
        .navrow__icon {
          display: grid; place-items: center;
          width: 34px; height: 34px; flex: none;
          border-radius: var(--r-sm);
          background: var(--surface-2); color: var(--text-2);
        }
        .navrow__text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .navrow__title {
          font-size: var(--fs-sm); font-weight: 600;
        }
        .navrow__meta { font-size: var(--fs-tiny); color: var(--text-3); }
      `}</style>
    </Link>
  )
}
