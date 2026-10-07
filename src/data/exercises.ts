/* ============================================================================
   Seed exercise library + the built-in programme templates.

   Each exercise carries the equipment it needs so the library can filter down to
   what the user said they have during onboarding — a home-only user should never
   scroll past twelve machine rows to find a push-up.

   `cues` are short imperatives, one idea each. They are the part a lifter reads
   between sets, so they are written to be read in two seconds, not studied.
   ========================================================================= */

import type { Equipment, Exercise, MuscleGroup, WorkoutPlan } from '../lib/types'

const ex = (
  id: string,
  name: string,
  muscle: MuscleGroup,
  equipment: Equipment,
  cues: string[],
  opts: Partial<Exercise> = {},
): Exercise => ({
  id,
  name,
  muscle,
  equipment,
  cues,
  defaultSets: 3,
  defaultRepRange: [8, 12],
  ...opts,
})

export const SEED_EXERCISES: Exercise[] = [
  /* --------------------------------- chest -------------------------------- */
  ex('bench-press', 'Barbell bench press', 'chest', 'barbells', [
    'Shoulder blades pinched down and back',
    'Bar touches just below the nipple line',
    'Drive your feet into the floor',
  ], { secondary: ['triceps', 'shoulders'], defaultRepRange: [5, 8] }),
  ex('incline-bench', 'Incline barbell press', 'chest', 'barbells', [
    'Bench at 30 degrees, no higher',
    'Bar meets the upper chest',
  ], { secondary: ['shoulders', 'triceps'], defaultRepRange: [6, 10] }),
  ex('db-bench', 'Dumbbell bench press', 'chest', 'dumbbells', [
    'Elbows at roughly 45 degrees from your body',
    'Stop the lowering when the dumbbells reach chest level',
  ], { secondary: ['triceps'] }),
  ex('db-incline', 'Incline dumbbell press', 'chest', 'dumbbells', [
    'Keep the wrists stacked over the elbows',
    'Squeeze at the top without clanging the bells',
  ], { secondary: ['shoulders'] }),
  ex('db-fly', 'Dumbbell fly', 'chest', 'dumbbells', [
    'Slight elbow bend, hold it throughout',
    'Think about hugging a barrel',
  ], { defaultRepRange: [10, 15] }),
  ex('cable-fly', 'Cable fly', 'chest', 'cables', [
    'Lead with the elbows, finish with the hands',
    'Hold the squeeze for a beat',
  ], { defaultRepRange: [12, 15] }),
  ex('pec-deck', 'Pec deck / machine fly', 'chest', 'machines', [
    'Back flat against the pad',
    'Control the return, do not let it snap back',
  ], { defaultRepRange: [10, 15] }),
  ex('pushup', 'Push-up', 'chest', 'bodyweight', [
    'Body in one straight line from head to heels',
    'Elbows track back at 45 degrees, not flared wide',
  ], { secondary: ['triceps', 'core'], isBodyweight: true, defaultRepRange: [10, 20] }),
  ex('dip-chest', 'Chest dip', 'chest', 'bodyweight', [
    'Lean the torso forward',
    'Go to a comfortable depth, not a painful one',
  ], { secondary: ['triceps'], isBodyweight: true, defaultRepRange: [6, 12] }),

  /* ---------------------------------- back -------------------------------- */
  ex('deadlift', 'Deadlift', 'back', 'barbells', [
    'Bar over mid-foot before you pull',
    'Chest up, then push the floor away',
    'Lock out with the glutes, not the lower back',
  ], { secondary: ['hamstrings', 'glutes'], defaultRepRange: [3, 6], defaultSets: 4 }),
  ex('barbell-row', 'Barbell row', 'back', 'barbells', [
    'Hinge to about 45 degrees and hold it',
    'Pull to the lower ribs, not the chest',
  ], { secondary: ['biceps'], defaultRepRange: [6, 10] }),
  ex('pullup', 'Pull-up', 'back', 'bodyweight', [
    'Start from a dead hang',
    'Lead with the chest, not the chin',
  ], { secondary: ['biceps'], isBodyweight: true, defaultRepRange: [5, 12] }),
  ex('chinup', 'Chin-up', 'back', 'bodyweight', [
    'Underhand grip, shoulder width',
    'Pull the elbows down into your ribs',
  ], { secondary: ['biceps'], isBodyweight: true, defaultRepRange: [5, 12] }),
  ex('lat-pulldown', 'Lat pulldown', 'back', 'cables', [
    'Bar to the collarbone, elbows down',
    'Do not lean back past 15 degrees',
  ], { secondary: ['biceps'] }),
  ex('seated-row', 'Seated cable row', 'back', 'cables', [
    'Chest proud, pull to the navel',
    'Let the shoulder blades travel, do not lock them',
  ], { secondary: ['biceps'] }),
  ex('db-row', 'One-arm dumbbell row', 'back', 'dumbbells', [
    'Flat back, hips square',
    'Pull the elbow past the ribs',
  ], { secondary: ['biceps'], defaultRepRange: [8, 12] }),
  ex('tbar-row', 'T-bar row', 'back', 'machines', [
    'Neutral spine, no bouncing at the bottom',
  ], { secondary: ['biceps'], defaultRepRange: [8, 12] }),
  ex('face-pull', 'Face pull', 'back', 'cables', [
    'Rope to the forehead, elbows high',
    'Finish with the thumbs pointing back',
  ], { secondary: ['shoulders'], defaultRepRange: [12, 20] }),
  ex('shrug', 'Barbell shrug', 'back', 'barbells', [
    'Straight up, no rolling',
    'Pause at the top',
  ], { defaultRepRange: [10, 15] }),

  /* ------------------------------- shoulders ------------------------------ */
  ex('ohp', 'Overhead press', 'shoulders', 'barbells', [
    'Brace the core before the bar leaves the rack',
    'Move the head back as the bar passes the face',
  ], { secondary: ['triceps'], defaultRepRange: [5, 8] }),
  ex('db-shoulder-press', 'Dumbbell shoulder press', 'shoulders', 'dumbbells', [
    'Elbows slightly in front of the body',
    'Do not clash the dumbbells overhead',
  ], { secondary: ['triceps'] }),
  ex('lateral-raise', 'Lateral raise', 'shoulders', 'dumbbells', [
    'Lead with the elbows',
    'Stop at shoulder height',
  ], { defaultRepRange: [12, 20] }),
  ex('front-raise', 'Front raise', 'shoulders', 'dumbbells', [
    'No swinging from the hips',
  ], { defaultRepRange: [12, 15] }),
  ex('rear-delt-fly', 'Rear delt fly', 'shoulders', 'dumbbells', [
    'Hinge forward, thumbs down',
    'Small range, high control',
  ], { defaultRepRange: [12, 20] }),
  ex('arnold-press', 'Arnold press', 'shoulders', 'dumbbells', [
    'Rotate as you press, not before',
  ], { secondary: ['triceps'], defaultRepRange: [8, 12] }),
  ex('upright-row', 'Upright row', 'shoulders', 'barbells', [
    'Pull to the lower chest only',
    'Stop if the shoulder pinches',
  ], { defaultRepRange: [10, 15] }),
  ex('pike-pushup', 'Pike push-up', 'shoulders', 'bodyweight', [
    'Hips high, head travels between the hands',
  ], { secondary: ['triceps'], isBodyweight: true, defaultRepRange: [8, 15] }),

  /* --------------------------------- biceps ------------------------------- */
  ex('barbell-curl', 'Barbell curl', 'biceps', 'barbells', [
    'Elbows pinned to your sides',
    'No hip swing — if it swings, drop the weight',
  ], { defaultRepRange: [8, 12] }),
  ex('db-curl', 'Dumbbell curl', 'biceps', 'dumbbells', [
    'Supinate as you lift',
    'Lower over three seconds',
  ], { defaultRepRange: [10, 14] }),
  ex('hammer-curl', 'Hammer curl', 'biceps', 'dumbbells', [
    'Neutral grip the whole way',
  ], { secondary: ['forearms'], defaultRepRange: [10, 14] }),
  ex('incline-curl', 'Incline dumbbell curl', 'biceps', 'dumbbells', [
    'Let the arms hang behind the body at the bottom',
  ], { defaultRepRange: [10, 14] }),
  ex('preacher-curl', 'Preacher curl', 'biceps', 'machines', [
    'Armpits into the pad',
    'Do not fully lock out at the bottom',
  ], { defaultRepRange: [10, 14] }),
  ex('cable-curl', 'Cable curl', 'biceps', 'cables', [
    'Constant tension — do not rest at the bottom',
  ], { defaultRepRange: [12, 15] }),
  ex('band-curl', 'Resistance band curl', 'biceps', 'bands', [
    'Stand on the band for a stable base',
  ], { defaultRepRange: [15, 25] }),

  /* -------------------------------- triceps ------------------------------- */
  ex('close-grip-bench', 'Close-grip bench press', 'triceps', 'barbells', [
    'Hands just inside shoulder width',
    'Elbows tucked in',
  ], { secondary: ['chest'], defaultRepRange: [6, 10] }),
  ex('skullcrusher', 'Skullcrusher', 'triceps', 'barbells', [
    'Upper arms stay vertical',
    'Lower to the forehead, not the chest',
  ], { defaultRepRange: [10, 12] }),
  ex('tricep-pushdown', 'Tricep pushdown', 'triceps', 'cables', [
    'Elbows glued to your sides',
    'Full extension, no lockout slam',
  ], { defaultRepRange: [10, 15] }),
  ex('overhead-ext', 'Overhead tricep extension', 'triceps', 'dumbbells', [
    'Keep the ribs down',
    'Elbows point forward, not out',
  ], { defaultRepRange: [10, 15] }),
  ex('dip-tricep', 'Tricep dip', 'triceps', 'bodyweight', [
    'Torso upright',
    'Stop at 90 degrees of elbow bend',
  ], { isBodyweight: true, defaultRepRange: [8, 15] }),
  ex('diamond-pushup', 'Diamond push-up', 'triceps', 'bodyweight', [
    'Hands under the sternum, thumbs touching',
  ], { secondary: ['chest'], isBodyweight: true, defaultRepRange: [8, 15] }),

  /* --------------------------------- quads -------------------------------- */
  ex('squat', 'Barbell back squat', 'quads', 'barbells', [
    'Brace as if someone is about to punch you',
    'Knees track over the toes',
    'Depth before weight',
  ], { secondary: ['glutes', 'hamstrings'], defaultRepRange: [5, 8], defaultSets: 4 }),
  ex('front-squat', 'Front squat', 'quads', 'barbells', [
    'Elbows up throughout',
    'Stay upright — the bar wants to roll forward',
  ], { secondary: ['core'], defaultRepRange: [5, 8] }),
  ex('leg-press', 'Leg press', 'quads', 'machines', [
    'Do not let the lower back round off the pad',
    'Knees to about 90 degrees',
  ], { secondary: ['glutes'], defaultRepRange: [10, 15] }),
  ex('goblet-squat', 'Goblet squat', 'quads', 'dumbbells', [
    'Elbows inside the knees at the bottom',
  ], { secondary: ['glutes'], defaultRepRange: [10, 15] }),
  ex('lunge', 'Walking lunge', 'quads', 'dumbbells', [
    'Long step, upright torso',
    'Push through the front heel',
  ], { secondary: ['glutes'], defaultRepRange: [10, 14] }),
  ex('bulgarian-split', 'Bulgarian split squat', 'quads', 'dumbbells', [
    'Front shin close to vertical',
    'Most of the load on the front leg',
  ], { secondary: ['glutes'], defaultRepRange: [8, 12] }),
  ex('leg-extension', 'Leg extension', 'quads', 'machines', [
    'Pause for one second at the top',
  ], { defaultRepRange: [12, 15] }),
  ex('bw-squat', 'Bodyweight squat', 'quads', 'bodyweight', [
    'Sit back and down, heels planted',
  ], { secondary: ['glutes'], isBodyweight: true, defaultRepRange: [15, 30] }),
  ex('step-up', 'Step-up', 'quads', 'bodyweight', [
    'Knee-height box, no pushing off the back foot',
  ], { secondary: ['glutes'], isBodyweight: true, defaultRepRange: [10, 15] }),

  /* ------------------------------- hamstrings ----------------------------- */
  ex('rdl', 'Romanian deadlift', 'hamstrings', 'barbells', [
    'Push the hips back, bar slides down the thighs',
    'Stop when the hamstrings tighten',
  ], { secondary: ['glutes', 'back'], defaultRepRange: [8, 12] }),
  ex('leg-curl', 'Lying leg curl', 'hamstrings', 'machines', [
    'Hips down on the pad',
    'Control the way back',
  ], { defaultRepRange: [10, 15] }),
  ex('seated-leg-curl', 'Seated leg curl', 'hamstrings', 'machines', [
    'Drive the heels under the seat',
  ], { defaultRepRange: [10, 15] }),
  ex('db-rdl', 'Dumbbell Romanian deadlift', 'hamstrings', 'dumbbells', [
    'Soft knees, long spine',
  ], { secondary: ['glutes'], defaultRepRange: [10, 12] }),
  ex('nordic-curl', 'Nordic hamstring curl', 'hamstrings', 'bodyweight', [
    'Lower as slowly as you can control',
    'Hands ready to catch you',
  ], { isBodyweight: true, defaultRepRange: [4, 8] }),
  ex('glute-bridge', 'Glute bridge', 'glutes', 'bodyweight', [
    'Ribs down, squeeze at the top',
  ], { secondary: ['hamstrings'], isBodyweight: true, defaultRepRange: [15, 25] }),
  ex('hip-thrust', 'Barbell hip thrust', 'glutes', 'barbells', [
    'Chin tucked, ribs down',
    'Full lockout, pause at the top',
  ], { secondary: ['hamstrings'], defaultRepRange: [8, 12] }),
  ex('cable-kickback', 'Cable glute kickback', 'glutes', 'cables', [
    'Move from the hip only',
  ], { defaultRepRange: [12, 20] }),

  /* --------------------------------- calves ------------------------------- */
  ex('standing-calf', 'Standing calf raise', 'calves', 'machines', [
    'Full stretch at the bottom, full squeeze at the top',
    'No bouncing',
  ], { defaultRepRange: [12, 20] }),
  ex('seated-calf', 'Seated calf raise', 'calves', 'machines', [
    'Slow three-second lowering',
  ], { defaultRepRange: [12, 20] }),
  ex('db-calf', 'Dumbbell calf raise', 'calves', 'dumbbells', [
    'Use a step for a deeper stretch',
  ], { defaultRepRange: [15, 25] }),

  /* ---------------------------------- core -------------------------------- */
  ex('plank', 'Plank', 'core', 'bodyweight', [
    'Squeeze glutes, tuck the ribs',
    'Log the hold in seconds under reps',
  ], { isBodyweight: true, defaultRepRange: [30, 60], defaultSets: 3 }),
  ex('hanging-leg-raise', 'Hanging leg raise', 'core', 'bodyweight', [
    'Curl the pelvis, do not just swing the legs',
  ], { isBodyweight: true, defaultRepRange: [8, 15] }),
  ex('cable-crunch', 'Cable crunch', 'core', 'cables', [
    'Crunch the ribs toward the hips',
  ], { defaultRepRange: [12, 20] }),
  ex('russian-twist', 'Russian twist', 'core', 'bodyweight', [
    'Rotate from the ribs, not the arms',
  ], { isBodyweight: true, defaultRepRange: [20, 30] }),
  ex('dead-bug', 'Dead bug', 'core', 'bodyweight', [
    'Lower back stays flat on the floor',
  ], { isBodyweight: true, defaultRepRange: [10, 16] }),
  ex('ab-wheel', 'Ab wheel rollout', 'core', 'bodyweight', [
    'Go only as far as you can hold the ribs down',
  ], { isBodyweight: true, defaultRepRange: [8, 15] }),

  /* ------------------------------- full body ------------------------------ */
  ex('burpee', 'Burpee', 'full-body', 'bodyweight', [
    'Chest to floor, full stand at the top',
  ], { isBodyweight: true, defaultRepRange: [10, 20] }),
  ex('kb-swing', 'Kettlebell swing', 'full-body', 'dumbbells', [
    'Hinge, do not squat',
    'The arms are rope, the hips are the engine',
  ], { secondary: ['glutes', 'hamstrings'], defaultRepRange: [15, 25] }),
  ex('clean-press', 'Clean and press', 'full-body', 'barbells', [
    'Explode from the hips',
    'Catch with the elbows under the bar',
  ], { secondary: ['shoulders'], defaultRepRange: [5, 8] }),
  ex('band-pull-apart', 'Band pull-apart', 'back', 'bands', [
    'Straight arms, squeeze the blades',
  ], { secondary: ['shoulders'], defaultRepRange: [15, 25] }),
]

/** Which equipment satisfies an exercise — a full gym covers everything. */
export function hasEquipment(owned: Equipment[], needed: Equipment): boolean {
  if (owned.includes('full-gym')) return true
  if (needed === 'bodyweight') return true
  return owned.includes(needed)
}

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
  forearms: 'Forearms',
  'full-body': 'Full body',
}

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  'full-gym': 'Full gym',
  dumbbells: 'Dumbbells',
  barbells: 'Barbells',
  machines: 'Machines',
  cables: 'Cables',
  bands: 'Bands',
  bodyweight: 'Bodyweight',
}

/* ===========================================================================
   Built-in programme templates (spec §13). The six-day split in the brief is
   the default because it is the one the user wrote out; the rest cover the
   common cases.
   ======================================================================== */

const plan = (
  id: string,
  name: string,
  description: string,
  days: Array<[number, string, string[]]>,
): WorkoutPlan => ({
  id,
  name,
  description,
  builtIn: true,
  createdAt: '2026-01-01',
  days: Array.from({ length: 7 }, (_, weekday) => {
    const row = days.find((d) => d[0] === weekday)
    return row
      ? { weekday, title: row[1], rest: row[2].length === 0, exerciseIds: row[2] }
      : { weekday, title: 'Rest', rest: true, exerciseIds: [] }
  }),
})

export const SEED_PLANS: WorkoutPlan[] = [
  plan(
    'plan-ppl6',
    'Six-day split',
    'Legs / Push / Pull twice a week, Sunday off. The programme from your brief.',
    [
      [1, 'Legs', ['squat', 'rdl', 'leg-press', 'leg-curl', 'standing-calf']],
      [2, 'Chest + Shoulders + Triceps', ['bench-press', 'db-incline', 'db-shoulder-press', 'lateral-raise', 'tricep-pushdown']],
      [3, 'Back + Biceps', ['deadlift', 'lat-pulldown', 'barbell-row', 'face-pull', 'db-curl']],
      [4, 'Legs', ['front-squat', 'bulgarian-split', 'leg-extension', 'seated-leg-curl', 'seated-calf']],
      [5, 'Chest + Shoulders + Triceps', ['db-bench', 'incline-bench', 'ohp', 'rear-delt-fly', 'skullcrusher']],
      [6, 'Back + Biceps', ['pullup', 'seated-row', 'db-row', 'shrug', 'hammer-curl']],
    ],
  ),
  plan(
    'plan-fatloss',
    'Fat loss',
    'Four full-body sessions. Compound lifts plus a short core finisher, built to pair with cardio.',
    [
      [1, 'Full body A', ['squat', 'db-bench', 'seated-row', 'plank']],
      [2, 'Full body B', ['rdl', 'db-shoulder-press', 'lat-pulldown', 'russian-twist']],
      [4, 'Full body A', ['leg-press', 'incline-bench', 'barbell-row', 'hanging-leg-raise']],
      [5, 'Full body B', ['hip-thrust', 'ohp', 'pullup', 'dead-bug']],
    ],
  ),
  plan(
    'plan-muscle',
    'Muscle building',
    'Upper / lower, four days. Heavier compounds first, isolation after.',
    [
      [1, 'Upper', ['bench-press', 'barbell-row', 'db-shoulder-press', 'lat-pulldown', 'barbell-curl', 'skullcrusher']],
      [2, 'Lower', ['squat', 'rdl', 'leg-press', 'leg-curl', 'standing-calf']],
      [4, 'Upper', ['ohp', 'pullup', 'db-incline', 'seated-row', 'hammer-curl', 'tricep-pushdown']],
      [5, 'Lower', ['deadlift', 'front-squat', 'bulgarian-split', 'seated-leg-curl', 'seated-calf']],
    ],
  ),
  plan(
    'plan-beginner',
    'Beginner',
    'Three full-body days. Same handful of lifts each week so technique and load both climb.',
    [
      [1, 'Full body', ['goblet-squat', 'db-bench', 'seated-row', 'plank']],
      [3, 'Full body', ['rdl', 'db-shoulder-press', 'lat-pulldown', 'dead-bug']],
      [5, 'Full body', ['leg-press', 'pushup', 'db-row', 'glute-bridge']],
    ],
  ),
  plan(
    'plan-home',
    'Home workout',
    'Four bodyweight and band sessions. No gym needed.',
    [
      [1, 'Push', ['pushup', 'pike-pushup', 'diamond-pushup', 'plank']],
      [2, 'Legs', ['bw-squat', 'lunge', 'glute-bridge', 'step-up']],
      [4, 'Pull', ['pullup', 'band-pull-apart', 'band-curl', 'dead-bug']],
      [5, 'Full body', ['burpee', 'kb-swing', 'bw-squat', 'russian-twist']],
    ],
  ),
]
