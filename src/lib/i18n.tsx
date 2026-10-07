/* ============================================================================
   Localization. A tiny t() over flat dictionaries — no library, because the only
   requirement is "don't hard-code text" (spec §39) and a dependency buys nothing
   at this size.

   English is the source of truth: a missing Tamil key falls back to English
   rather than rendering the key, so a partial translation never breaks a screen.
   `html[lang]` is kept in sync so Noto Sans Tamil is picked up and screen
   readers switch voice.
   ========================================================================= */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import type { Lang } from './types'

type Dict = Record<string, string>

const en: Dict = {
  'app.name': 'Forge',
  'app.tagline': 'Transformation log',

  // nav
  'nav.home': 'Home',
  'nav.workout': 'Workout',
  'nav.nutrition': 'Nutrition',
  'nav.progress': 'Progress',
  'nav.more': 'More',

  // common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.done': 'Done',
  'common.add': 'Add',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.remove': 'Remove',
  'common.close': 'Close',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.skip': 'Skip',
  'common.search': 'Search',
  'common.today': 'Today',
  'common.yesterday': 'Yesterday',
  'common.target': 'Target',
  'common.current': 'Current',
  'common.start': 'Start',
  'common.finish': 'Finish',
  'common.undo': 'Undo',
  'common.retry': 'Retry',
  'common.of': 'of',
  'common.left': 'left',
  'common.none': 'None',
  'common.optional': 'Optional',
  'common.required': 'Required',
  'common.week': 'Week',
  'common.day': 'Day',
  'common.days': 'days',
  'common.create': 'Create',
  'common.saved': 'Saved',

  // onboarding
  'onb.welcome.title': 'Build the body you are training for',
  'onb.welcome.body':
    'Forge keeps your whole transformation in one log — weight, training, food, cardio, sleep and habits. Setup takes about a minute.',
  'onb.welcome.cta': 'Start setup',
  'onb.step': 'Step {n} of {total}',
  'onb.you.title': 'About you',
  'onb.you.body': 'Used to estimate your calorie and protein targets. Nothing leaves this device.',
  'onb.name': 'What should we call you?',
  'onb.age': 'Age',
  'onb.sex': 'Sex',
  'onb.height': 'Height',
  'onb.weight.title': 'Where you are, where you are going',
  'onb.weight.current': 'Current weight',
  'onb.weight.target': 'Target weight',
  'onb.goal.title': "What's the goal?",
  'onb.activity.title': 'How active is a normal day?',
  'onb.activity.body': 'Not counting workouts — just daily life and work.',
  'onb.experience.title': 'How long have you been training?',
  'onb.equipment.title': 'What can you train with?',
  'onb.equipment.body': 'Pick everything you have access to.',
  'onb.days.title': 'Which days will you train?',
  'onb.prefs.title': 'Preferences',
  'onb.targets.title': 'Your starting targets',
  'onb.targets.body':
    'Calculated from your numbers. Edit anything now, or change it later in Settings.',
  'onb.targets.cta': 'Start my log',
  'onb.targets.recalc': 'Reset to suggested',

  // goals
  'goal.fat-loss': 'Fat loss',
  'goal.muscle-gain': 'Muscle gain',
  'goal.recomp': 'Body recomposition',
  'goal.maintenance': 'Maintenance',
  'goal.general': 'General fitness',
  'goal.custom': 'Custom',
  'goal.fat-loss.hint': 'Lose fat, hold on to muscle',
  'goal.muscle-gain.hint': 'Add size and strength',
  'goal.recomp.hint': 'Lose fat and gain muscle together',
  'goal.maintenance.hint': 'Hold your current shape',
  'goal.general.hint': 'Be fitter and more consistent',
  'goal.custom.hint': 'Set your own targets',

  // activity
  'activity.sedentary': 'Sedentary',
  'activity.light': 'Lightly active',
  'activity.moderate': 'Moderately active',
  'activity.very': 'Very active',
  'activity.extreme': 'Extremely active',
  'activity.sedentary.hint': 'Desk job, little walking',
  'activity.light.hint': 'Some walking through the day',
  'activity.moderate.hint': 'On your feet regularly',
  'activity.very.hint': 'Physical job or lots of walking',
  'activity.extreme.hint': 'Heavy labour or two-a-day training',

  // experience
  'exp.beginner': 'Beginner',
  'exp.intermediate': 'Intermediate',
  'exp.advanced': 'Advanced',
  'exp.beginner.hint': 'Under a year',
  'exp.intermediate.hint': 'One to three years',
  'exp.advanced.hint': 'Three years or more',

  // equipment
  'equip.full-gym': 'Full gym',
  'equip.dumbbells': 'Dumbbells',
  'equip.barbells': 'Barbells',
  'equip.machines': 'Machines',
  'equip.cables': 'Cables',
  'equip.bands': 'Resistance bands',
  'equip.bodyweight': 'Bodyweight / home',

  // home
  'home.greeting.morning': 'Good morning',
  'home.greeting.afternoon': 'Good afternoon',
  'home.greeting.evening': 'Good evening',
  'home.today': "Today's plan",
  'home.score': 'Transformation score',
  'home.score.hint': 'Seven inputs, weighted. Tap a segment to see what is cold.',
  'home.streak': 'Streak',
  'home.weight': 'Weight',
  'home.nutrition': 'Food',
  'home.training': 'Training',
  'home.movement': 'Movement',
  'home.sleep': 'Sleep',
  'home.habits': 'Habits',
  'home.records': 'Records',
  'home.challenge': 'Challenge',
  'home.logWeight': 'Log weight',
  'home.startWorkout': 'Start workout',
  'home.checkIn': 'Daily check-in',
  'home.checkIn.done': 'Checked in',
  'home.restDay': 'Rest day',
  'home.restDay.body': 'Nothing scheduled. Recovery is part of the programme.',
  'home.noPlan': 'No programme yet',
  'home.noPlan.body': 'Pick a template or build your own week.',
  'home.customise': 'Customise dashboard',

  // weight
  'weight.title': 'Weight',
  'weight.start': 'Start',
  'weight.now': 'Now',
  'weight.goal': 'Goal',
  'weight.lost': 'Lost',
  'weight.gained': 'Gained',
  'weight.trend': 'Trend',
  'weight.trend.hint':
    'A smoothed line through your entries. It moves slower than the scale — that is the point.',
  'weight.weeklyAvg': 'Weekly average',
  'weight.rate': 'Rate',
  'weight.perWeek': '/week',
  'weight.remaining': 'To go',
  'weight.predict': 'Estimated goal date',
  'weight.predict.low': 'Rough estimate — more entries will sharpen it.',
  'weight.predict.flat': 'Weight is holding steady. No date yet.',
  'weight.predict.wrongWay': 'Current trend is moving away from your target.',
  'weight.predict.none': 'Log a few more weigh-ins for an estimate.',
  'weight.predict.reached': 'You are at your target.',
  'weight.predict.caveat': 'An estimate from your own trend, not a promise.',
  'weight.log': 'Log weight',
  'weight.empty': 'No weigh-ins yet',
  'weight.empty.body': 'Log your weight to start the trend line.',

  // nutrition
  'nutri.title': 'Nutrition',
  'nutri.calories': 'Calories',
  'nutri.protein': 'Protein',
  'nutri.carbs': 'Carbs',
  'nutri.fat': 'Fat',
  'nutri.breakfast': 'Breakfast',
  'nutri.lunch': 'Lunch',
  'nutri.snacks': 'Snacks',
  'nutri.dinner': 'Dinner',
  'nutri.other': 'Other',
  'nutri.addFood': 'Add food',
  'nutri.searchFood': 'Search foods',
  'nutri.quickAdd': 'Quick add',
  'nutri.quickAdd.hint': 'Know the numbers already? Enter calories and protein.',
  'nutri.savedMeals': 'Saved meals',
  'nutri.customFood': 'Create a food',
  'nutri.saveAsMeal': 'Save as a meal',
  'nutri.serving': 'Serving',
  'nutri.qty': 'Servings',
  'nutri.remaining': 'remaining',
  'nutri.over': 'over',
  'nutri.empty': 'Nothing logged yet',
  'nutri.empty.body': 'Add your first meal and the day fills in.',
  'nutri.noResults': 'No foods match',
  'nutri.noResults.body': 'Try a shorter word, or create the food yourself.',

  // workout
  'wk.title': 'Workout',
  'wk.start': 'Start workout',
  'wk.resume': 'Resume workout',
  'wk.finish': 'Finish workout',
  'wk.discard': 'Discard workout',
  'wk.today': "Today's session",
  'wk.freeSession': 'Free session',
  'wk.addExercise': 'Add exercise',
  'wk.sets': 'Sets',
  'wk.set': 'Set',
  'wk.reps': 'Reps',
  'wk.weight': 'Weight',
  'wk.rpe': 'RPE',
  'wk.rest': 'Rest',
  'wk.notes': 'Notes',
  'wk.duration': 'Duration',
  'wk.volume': 'Volume',
  'wk.last': 'Last time',
  'wk.suggest': 'Try',
  'wk.suggest.addLoad': 'Rep target met — add load',
  'wk.suggest.addReps': 'Same load, one more rep',
  'wk.suggest.hold': 'Repeat this to lock it in',
  'wk.suggest.deload': 'Back off and rebuild',
  'wk.suggest.first': 'First time — find a working weight',
  'wk.complete': 'Workout complete',
  'wk.plans': 'Programmes',
  'wk.plan.active': 'Active',
  'wk.plan.use': 'Make active',
  'wk.plan.new': 'Build a programme',
  'wk.library': 'Exercise library',
  'wk.history': 'History',
  'wk.restTimer': 'Rest timer',
  'wk.empty': 'No sessions logged yet',
  'wk.empty.body': 'Start a workout and every set is remembered.',

  // records
  'pr.title': 'Personal records',
  'pr.gym': 'Gym records',
  'pr.other': 'Other records',
  'pr.heaviest': 'Heaviest',
  'pr.bestReps': 'Most reps',
  'pr.best1rm': 'Best estimated 1RM',
  'pr.new': 'New record',
  'pr.empty': 'No records yet',
  'pr.empty.body': 'Finish a workout and your first records appear here.',

  // cardio / steps
  'cardio.title': 'Cardio & steps',
  'cardio.steps': 'Steps',
  'cardio.walk': 'Walk',
  'cardio.run': 'Run',
  'cardio.cycle': 'Cycle',
  'cardio.treadmill': 'Treadmill',
  'cardio.other': 'Other',
  'cardio.minutes': 'Minutes',
  'cardio.distance': 'Distance',
  'cardio.speed': 'Speed',
  'cardio.incline': 'Incline',
  'cardio.log': 'Log cardio',
  'cardio.logSteps': 'Log steps',
  'cardio.empty': 'No cardio logged',
  'cardio.empty.body': 'A walk counts. Log it and the streak keeps moving.',

  // sleep
  'sleep.title': 'Sleep',
  'sleep.start': 'Lights out',
  'sleep.wake': 'Woke up',
  'sleep.total': 'Slept',
  'sleep.target': 'Target',
  'sleep.avg': 'Weekly average',
  'sleep.quality': 'How did you sleep?',
  'sleep.log': 'Log sleep',
  'sleep.empty': 'No sleep logged',
  'sleep.empty.body': 'Two taps a morning. Recovery shows up in the numbers.',

  // check-in
  'ci.title': 'Daily check-in',
  'ci.body': 'Twenty seconds. Skip anything you do not want to answer.',
  'ci.energy': 'Energy',
  'ci.hunger': 'Hunger',
  'ci.cravings': 'Cravings',
  'ci.mood': 'Mood',
  'ci.note': 'Anything worth remembering?',
  'ci.save': 'Save check-in',
  'ci.done': 'Checked in for today',

  // habits
  'habits.title': 'Habits',
  'habits.new': 'Add a habit',
  'habits.auto': 'Automatic',
  'habits.auto.hint': 'Ticked by your data — you never tap it',
  'habits.weekly': 'This week',
  'habits.monthly': 'This month',
  'habits.streak': 'Streak',
  'habits.empty': 'No habits yet',
  'habits.empty.body': 'Two or three is plenty. Pick the ones that move the needle.',

  // supplements
  'supp.title': 'Supplements',
  'supp.new': 'Add a supplement',
  'supp.dosage': 'Dosage',
  'supp.taken': 'Taken',
  'supp.time': 'When',
  'supp.remind': 'Remind me',
  'supp.empty': 'Nothing tracked',
  'supp.empty.body': 'Add what you actually take, so the log matches reality.',

  // progress / photos
  'prog.title': 'Progress',
  'photos.title': 'Progress photos',
  'photos.add': 'Add photo',
  'photos.front': 'Front',
  'photos.side': 'Side',
  'photos.back': 'Back',
  'photos.compare': 'Compare',
  'photos.timeline': 'Timeline',
  'photos.private': 'Private',
  'photos.private.body':
    'Photos stay on this device. Nothing is uploaded unless you share it yourself.',
  'photos.share': 'Allow sharing',
  'photos.empty': 'No photos yet',
  'photos.empty.body': 'A day-one photo is the most useful one you will ever take.',

  // analytics
  'an.title': 'Analytics',
  'an.weight': 'Weight',
  'an.nutrition': 'Nutrition',
  'an.training': 'Training',
  'an.cardio': 'Cardio',
  'an.sleep': 'Sleep',
  'an.habits': 'Habits',
  'an.frequency': 'Frequency',
  'an.volume': 'Volume',
  'an.strength': 'Strength',
  'an.range.7': '7 days',
  'an.range.30': '30 days',
  'an.range.90': '90 days',
  'an.table': 'Show values',
  'an.noData': 'No data for this range',
  'an.noData.body': 'Log a few days and the chart fills in.',

  // goals
  'goals.title': 'Goals',
  'goals.new': 'Set a goal',
  'goals.deadline': 'Deadline',
  'goals.progress': 'Progress',
  'goals.complete': 'Complete',
  'goals.overdue': 'Overdue',
  'goals.daysLeft': '{n} days left',
  'goals.empty': 'No goals set',
  'goals.empty.body': 'One clear goal beats five vague ones.',

  // challenge
  'ch.title': 'Challenge',
  'ch.new': 'Start a challenge',
  'ch.day': 'Day {n} / {total}',
  'ch.remaining': '{n} days remaining',
  'ch.complete': 'Challenge complete',
  'ch.startWeight': 'Start',
  'ch.goalWeight': 'Goal',
  'ch.length': 'Length',
  'ch.custom': 'Custom length',
  'ch.empty': 'No challenge running',
  'ch.empty.body': 'A fixed end date is the simplest way to stay honest.',

  // calendar
  'cal.title': 'Calendar',
  'cal.legend': 'What the marks mean',
  'cal.noRecord': 'Nothing logged on this day',

  // achievements
  'ach.title': 'Achievements',
  'ach.unlocked': 'Unlocked',
  'ach.locked': 'Locked',
  'ach.on': 'Unlocked {date}',

  // weekly review
  'rev.title': 'Weekly review',
  'rev.week': 'Week {n}',
  'rev.focus': 'Focus next week',
  'rev.noData': 'Not enough logged this week',
  'rev.noData.body': 'Log a few more days and the review writes itself.',

  // timeline
  'tl.title': 'Timeline',
  'tl.empty': 'Your story starts here',
  'tl.empty.body': 'Every weigh-in, PR and milestone lands on this thread.',

  // coach
  'coach.title': 'AI coach',
  'coach.ask': 'Ask your coach',
  'coach.placeholder': 'Ask about your progress, training or food…',
  'coach.local': 'Answered from your own data',
  'coach.needKey': 'Connect a model to chat freely',
  'coach.needKey.body':
    'Forge answers the common questions offline from your log. For open conversation, add an Anthropic API key in Settings.',

  // friends
  'fr.title': 'Friends',
  'fr.add': 'Add a friend',
  'fr.leaderboard': 'Leaderboard',
  'fr.privacy': 'Weight and photos are never shared.',
  'fr.empty': 'No friends added',
  'fr.empty.body': 'Add someone to compare streaks and workouts. Body data stays private.',

  // settings
  'set.title': 'Settings',
  'set.profile': 'Profile',
  'set.targets': 'Daily targets',
  'set.units': 'Units',
  'set.units.metric': 'Metric (kg, km, cm)',
  'set.units.imperial': 'Imperial (lb, mi, in)',
  'set.language': 'Language',
  'set.theme': 'Theme',
  'set.theme.dark': 'Dark',
  'set.theme.light': 'Light',
  'set.theme.system': 'System',
  'set.notifications': 'Reminders',
  'set.phases': 'Training phases',
  'set.backup': 'Backup',
  'set.backup.body':
    'Your log lives on this device. Save a backup file so a lost phone does not lose the journey.',
  'set.backup.save': 'Save a backup',
  'set.backup.restore': 'Restore from backup',
  'set.backup.last': 'Last backup {when}',
  'set.backup.never': 'Never backed up',
  'set.storage': 'Storage used',
  'set.reset': 'Erase everything',
  'set.reset.confirm': 'This deletes your whole log, including photos. It cannot be undone.',
  'set.about': 'About',
  'set.coaching': 'Coaching tone',
  'set.coaching.gentle': 'Gentle',
  'set.coaching.balanced': 'Balanced',
  'set.coaching.direct': 'Direct',

  // more
  'more.title': 'More',
  'more.tracking': 'Tracking',
  'more.progress': 'Progress',
  'more.system': 'System',
}

/* Tamil. Keys absent here fall back to English. */
const ta: Dict = {
  'app.tagline': 'மாற்றப் பதிவு',

  'nav.home': 'முகப்பு',
  'nav.workout': 'பயிற்சி',
  'nav.nutrition': 'உணவு',
  'nav.progress': 'முன்னேற்றம்',
  'nav.more': 'மேலும்',

  'common.save': 'சேமி',
  'common.cancel': 'ரத்து',
  'common.done': 'முடிந்தது',
  'common.add': 'சேர்',
  'common.edit': 'திருத்து',
  'common.delete': 'நீக்கு',
  'common.close': 'மூடு',
  'common.back': 'பின்',
  'common.next': 'அடுத்து',
  'common.skip': 'தவிர்',
  'common.search': 'தேடு',
  'common.today': 'இன்று',
  'common.yesterday': 'நேற்று',
  'common.target': 'இலக்கு',
  'common.current': 'தற்போது',
  'common.start': 'தொடங்கு',
  'common.finish': 'முடி',
  'common.week': 'வாரம்',
  'common.day': 'நாள்',
  'common.days': 'நாட்கள்',

  'onb.welcome.title': 'நீங்கள் பயிற்சி செய்யும் உடலை உருவாக்குங்கள்',
  'onb.welcome.cta': 'அமைப்பைத் தொடங்கு',
  'onb.you.title': 'உங்களைப் பற்றி',
  'onb.name': 'உங்களை எப்படி அழைக்கலாம்?',
  'onb.age': 'வயது',
  'onb.height': 'உயரம்',
  'onb.weight.current': 'தற்போதைய எடை',
  'onb.weight.target': 'இலக்கு எடை',
  'onb.goal.title': 'இலக்கு என்ன?',
  'onb.targets.title': 'உங்கள் தொடக்க இலக்குகள்',
  'onb.targets.cta': 'பதிவைத் தொடங்கு',

  'goal.fat-loss': 'கொழுப்பு குறைப்பு',
  'goal.muscle-gain': 'தசை வளர்ச்சி',
  'goal.recomp': 'உடல் மாற்றம்',
  'goal.maintenance': 'பராமரிப்பு',
  'goal.general': 'பொது உடற்பயிற்சி',
  'goal.custom': 'தனிப்பயன்',

  'activity.sedentary': 'அசைவில்லாத',
  'activity.light': 'சற்று சுறுசுறுப்பான',
  'activity.moderate': 'மிதமான',
  'activity.very': 'மிகவும் சுறுசுறுப்பான',
  'activity.extreme': 'தீவிர சுறுசுறுப்பான',

  'exp.beginner': 'தொடக்கநிலை',
  'exp.intermediate': 'இடைநிலை',
  'exp.advanced': 'மேல்நிலை',

  'home.greeting.morning': 'காலை வணக்கம்',
  'home.greeting.afternoon': 'மதிய வணக்கம்',
  'home.greeting.evening': 'மாலை வணக்கம்',
  'home.today': 'இன்றைய திட்டம்',
  'home.score': 'மாற்ற மதிப்பெண்',
  'home.streak': 'தொடர்',
  'home.weight': 'எடை',
  'home.nutrition': 'உணவு',
  'home.training': 'பயிற்சி',
  'home.movement': 'நடமாட்டம்',
  'home.sleep': 'தூக்கம்',
  'home.habits': 'பழக்கங்கள்',
  'home.logWeight': 'எடையைப் பதிவு செய்',
  'home.startWorkout': 'பயிற்சியைத் தொடங்கு',
  'home.checkIn': 'தினசரி சரிபார்ப்பு',
  'home.restDay': 'ஓய்வு நாள்',

  'weight.title': 'எடை',
  'weight.trend': 'போக்கு',
  'weight.goal': 'இலக்கு',
  'weight.remaining': 'மீதம்',
  'weight.log': 'எடையைப் பதிவு செய்',

  'nutri.title': 'உணவு',
  'nutri.calories': 'கலோரிகள்',
  'nutri.protein': 'புரதம்',
  'nutri.carbs': 'கார்போஹைட்ரேட்',
  'nutri.fat': 'கொழுப்பு',
  'nutri.breakfast': 'காலை உணவு',
  'nutri.lunch': 'மதிய உணவு',
  'nutri.snacks': 'சிற்றுண்டி',
  'nutri.dinner': 'இரவு உணவு',
  'nutri.addFood': 'உணவு சேர்',

  'wk.title': 'பயிற்சி',
  'wk.start': 'பயிற்சியைத் தொடங்கு',
  'wk.finish': 'பயிற்சியை முடி',
  'wk.sets': 'செட்கள்',
  'wk.reps': 'மறுபடி',
  'wk.weight': 'எடை',
  'wk.rest': 'ஓய்வு',
  'wk.last': 'கடைசி முறை',
  'wk.complete': 'பயிற்சி முடிந்தது',

  'cardio.title': 'கார்டியோ & படிகள்',
  'cardio.steps': 'படிகள்',
  'sleep.title': 'தூக்கம்',
  'habits.title': 'பழக்கங்கள்',
  'supp.title': 'சத்துமருந்துகள்',
  'prog.title': 'முன்னேற்றம்',
  'photos.title': 'முன்னேற்ற புகைப்படங்கள்',
  'an.title': 'பகுப்பாய்வு',
  'goals.title': 'இலக்குகள்',
  'ch.title': 'சவால்',
  'cal.title': 'நாட்காட்டி',
  'ach.title': 'சாதனைகள்',
  'rev.title': 'வாராந்திர மதிப்பாய்வு',
  'set.title': 'அமைப்புகள்',
  'set.language': 'மொழி',
  'set.theme': 'தீம்',
  'set.units': 'அலகுகள்',
  'more.title': 'மேலும்',
}

const DICTS: Record<Lang, Dict> = { en, ta }

export const LANGUAGES: Array<{ code: Lang; label: string; native: string }> = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
]

export type TFunc = (key: string, vars?: Record<string, string | number>) => string

function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const raw = DICTS[lang][key] ?? en[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`))
}

interface I18nValue {
  lang: Lang
  t: TFunc
  locale: string
}

const I18nContext = createContext<I18nValue>({
  lang: 'en',
  t: (k) => en[k] ?? k,
  locale: 'en-IN',
})

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = useCallback<TFunc>((key, vars) => translate(lang, key, vars), [lang])
  const value = useMemo(
    () => ({ lang, t, locale: lang === 'ta' ? 'ta-IN' : 'en-IN' }),
    [lang, t],
  )
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useT = () => useContext(I18nContext)
