/* ============================================================================
   The app shell: theme application, the onboarding gate, and routing.

   Routes are lazy below the five tab destinations. Home, Workout, Nutrition and
   Progress load eagerly because they are the daily path; everything reached
   through More is split out, which keeps the first paint small without making
   any daily action wait on a chunk.
   ========================================================================= */

import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useStore } from './lib/store'
import { I18nProvider } from './lib/i18n'
import { SideRail, TabBar } from './components/Nav'
import { Onboarding } from './screens/Onboarding'
import { Splash } from './screens/Splash'
import { Home } from './screens/Home'
import { Workout } from './screens/Workout'
import { Nutrition } from './screens/Nutrition'
import { Progress } from './screens/Progress'
import { More } from './screens/More'

const WorkoutSession = lazy(() => import('./screens/WorkoutSession'))
const ExerciseLibrary = lazy(() => import('./screens/ExerciseLibrary'))
const WorkoutPlans = lazy(() => import('./screens/WorkoutPlans'))
const SavedMeals = lazy(() => import('./screens/SavedMeals'))
const Weight = lazy(() => import('./screens/Weight'))
const Cardio = lazy(() => import('./screens/Cardio'))
const Sleep = lazy(() => import('./screens/Sleep'))
const CheckIn = lazy(() => import('./screens/CheckIn'))
const Habits = lazy(() => import('./screens/Habits'))
const Supplements = lazy(() => import('./screens/Supplements'))
const Photos = lazy(() => import('./screens/Photos'))
const Analytics = lazy(() => import('./screens/Analytics'))
const Goals = lazy(() => import('./screens/Goals'))
const Challenges = lazy(() => import('./screens/Challenges'))
const Calendar = lazy(() => import('./screens/Calendar'))
const Achievements = lazy(() => import('./screens/Achievements'))
const Records = lazy(() => import('./screens/Records'))
const WeeklyReviewScreen = lazy(() => import('./screens/WeeklyReview'))
const Timeline = lazy(() => import('./screens/Timeline'))
const Phases = lazy(() => import('./screens/Phases'))
const Friends = lazy(() => import('./screens/Friends'))
const Coach = lazy(() => import('./screens/Coach'))
const Settings = lazy(() => import('./screens/Settings'))

export function App() {
  const { data, ready } = useStore()
  const theme = data.profile?.theme ?? 'dark'

  // Theme is applied by stamping data-theme on <html>, which is what the token
  // layer keys off. 'system' removes the stamp so the media query takes over.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  if (!ready) return <Splash />

  return (
    <I18nProvider lang={data.profile?.lang ?? 'en'}>
      {!data.profile ? <Onboarding /> : <Main />}
    </I18nProvider>
  )
}

function Main() {
  return (
    <div className="app">
      <SideRail />
      <div className="app__main">
        <ScrollReset />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/workout" element={<Workout />} />
            <Route path="/workout/session/:id" element={<WorkoutSession />} />
            <Route path="/workout/plans" element={<WorkoutPlans />} />
            <Route path="/workout/library" element={<ExerciseLibrary />} />
            <Route path="/nutrition" element={<Nutrition />} />
            <Route path="/nutrition/saved" element={<SavedMeals />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/more" element={<More />} />

            <Route path="/weight" element={<Weight />} />
            <Route path="/cardio" element={<Cardio />} />
            <Route path="/sleep" element={<Sleep />} />
            <Route path="/check-in" element={<CheckIn />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/supplements" element={<Supplements />} />
            <Route path="/photos" element={<Photos />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/records" element={<Records />} />
            <Route path="/review" element={<WeeklyReviewScreen />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/phases" element={<Phases />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/coach" element={<Coach />} />
            <Route path="/settings" element={<Settings />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
      <TabBar />
    </div>
  )
}

/** Fresh routes start at the top; back navigation is left to the browser. */
function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function RouteFallback() {
  return (
    <div className="shell" aria-busy="true">
      <div style={{ paddingTop: 'calc(var(--safe-t) + var(--s-6))' }} className="stack-4">
        <div className="skeleton" style={{ height: 30, width: '45%' }} />
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 80 }} />
        <div className="skeleton" style={{ height: 80 }} />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}
