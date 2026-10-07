# Forge — Personal Fitness Transformation System

A mobile-first, local-first PWA that keeps a complete fitness journey in one log:
weight, training, nutrition, cardio, sleep, habits, photos, goals, challenges and
analytics.

**Core principle:** minimum input → maximum useful feedback. The user types a
weight, a few sets and a meal; the app derives trend lines, goal predictions,
personal records, progression suggestions, streaks and a daily score.

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # typecheck + production build
npm run preview    # serve the build on :4173
```

---

## Design direction

**"The Forge."** Training is metalwork — you apply heat repeatedly and the shape
changes. Heat is not decoration here, it is the app's single data encoding: every
completion reading (transformation score, habit consistency, calendar day,
weekly heat strip, target meters) is painted from one ordinal ramp, cold deep-rust
through white-hot amber. A cold number looks cold before you read it.

**The signature element** is the Forge Ring on Home. Most fitness apps draw one arc
filling toward a goal, which tells you the score and nothing else. This ring is
split into seven arcs, one per scoring input, each arc's *fill* showing that
input's completion and its *colour* its own heat. It answers two questions at
once: how was today, and which input is cold. Everything else in the app is kept
deliberately quiet so this can be the one loud thing.

### Typography

| Role | Face | Why |
|---|---|---|
| Display | **Archivo** 600–800, tight tracking | Gym-sign voice; headings and eyebrows |
| Body | **Hanken Grotesk** | Humanist, warm, not Inter |
| Data | **IBM Plex Mono**, tabular figures | Every logged number wears it, so data reads as data and nothing jitters when it changes |
| Tamil | **Noto Sans Tamil** | Loaded for the `ta` locale |

### Colour

Dark is the default (per spec §41); light is a *selected* counterpart, not an
inversion. Surfaces are warm charcoal rather than blue-black, and text is chalk
(`#F3F0EA`) rather than pure white, because this app gets read in a gym at 6am.
Elevation comes from hairline borders and surface steps, never drop shadows —
shadows read as mush on near-black.

All chart colour was **computed, not eyeballed**, with the data-viz validator:

- **Categorical series** — the validated reference palette, re-ordered ember-first
  so the brand hue leads. Re-validated at 6 slots on both surfaces: every adjacent
  CVD, normal-vision and contrast gate passes.
- **Kiln ramp** — a generated single-hue OKLCH ramp (hue 48, 5 steps) passing the
  ordinal gates: monotone lightness, ≥0.06 adjacent ΔL, light end 2.43:1 on the
  dark surface. Re-stepped for paper in light mode.
- Three light-mode slots sit under 3:1 on paper, so the **relief rule** applies and
  every chart ships direct labels plus a "Show values" table.

Rejected: the skill's suggested Orbitron/JetBrains pairing (sci-fi HUD is wrong for
a disciplined training ledger) and the acid-green-on-black fitness default.

---

## Architecture

```
src/
  lib/
    types.ts      domain model
    db.ts         IndexedDB: one document + a blob store for photos
    store.tsx     reducer + named actions + derived bookkeeping
    calc.ts       the calculation engine (see below)
    coach.ts      log analysis; builds both local answers and model context
    backup.ts     backup/restore — the whole "login" story
    date.ts       local YYYY-MM-DD keys, never timestamps
    units.ts      metric storage, converted only at the edges
    i18n.tsx      en + ta, English as fallback
  data/
    foods.ts      ~120 foods, Indian-weighted, with a scored search
    exercises.ts  ~80 exercises with cues + 5 built-in programmes
    achievements.ts  24 badges as pure predicates over AppData
  components/
    ForgeRing.tsx the signature element
    charts.tsx    hand-rolled SVG line/bar/stacked/heat-strip
    ui.tsx        sheet, stat, meter, stepper, toast, scale, rows
    Nav.tsx       bottom tabs < 1024px, side rail above
  screens/        23 screens
```

### Why a single document

Every interesting screen is a cross-entity read — the score needs food, training,
sleep and habits in one pass. Splitting state would mean re-joining it on every
render. One document in IndexedDB keeps reads trivial, writes atomic, and
backup/restore a single JSON blob. A full year of data is tens of KB.

Writes are debounced 400 ms and flushed on `visibilitychange`, with a localStorage
mirror for crash recovery. Progress photos live in a separate blob store and never
enter React state — screens hold object URLs and revoke them on unmount.

### The calculation engine

Everything the user does not type:

- **Targets** — Mifflin–St Jeor BMR × activity factor, offset by goal, floored at a
  safe intake. Protein is g/kg bodyweight by goal.
- **Weight trend** — a 14-point EWMA (α 0.25). It moves slower than the scale, which
  is the point: a 0.8 kg water swing shouldn't read as failure.
- **Rate** — least-squares slope over 28 days, converted to kg/week.
- **Goal prediction** — from the *actual* trend, not the planned deficit. It
  deliberately refuses to answer when the data can't support one, returning a
  reason (`flat`, `wrong-way`, `no-data`) and a confidence level instead of a
  number pretending to precision.
- **Transformation score** — seven weighted inputs out of 100. Nutrition and sleep
  score a *band*, not a ceiling (1,200 of a 2,200 target is not a win). A workout on
  a planned rest day scores full, because resting is the plan.
- **Smart progression** — reads the last session's top set, its RPE and whether the
  rep target was met, then moves one variable — load or reps, never both.
- **PRs** — recomputed from history on every mutation; `detectPrs` compares a
  finished session against records as they stood before it.

Derived bookkeeping (PR recomputation, achievement unlocks, non-gym records) runs
in one `reconcile()` pass inside the store, so no screen can forget it.

---

## Decisions worth knowing

**Auto habits.** A habit can be marked `auto` — hitting the protein target ticks it,
no tap required. The minimum-input rule applied to habit tracking.

**Nutrition has three entry paths** and quick-add matters most: most days a user
already knows roughly what they ate, and forcing exact database rows is how food
logging dies. Quick add keeps the streak alive on a bad day.

**Averages are honest about their denominator.** Calorie and protein averages cover
days food was logged, not all 30 — and the UI says so. Unlogged days would drag the
average into a lie.

**Predictions are labelled as estimates** everywhere they appear, with a confidence
reading derived from how many data points back them.

**Photos are private by default**, structurally: blobs stay on-device, nothing is
uploaded, `shared` defaults to false. The screen says so in plain words.

**The friend board is a local scorecard.** There is no backend in V1, so you type
your friends' numbers. Only consistency metrics are rankable — weight, body data
and photos are never comparable, per §34.

**Backup is the login story.** No mandatory account (§42), so identity is a random
`deviceId` minted on first run and carried inside the backup file. Restoring on a
new phone adopts it. The file contains everything including photos as base64 — a
backup that silently drops the day-one photo is not a backup.

---

## Phase status

### Phase 1 — MVP · complete
Onboarding, Home dashboard, weight, workout tracker, programmes, exercise library,
nutrition, food database, cardio/steps, sleep, daily check-in, goals, progress
photos, analytics, challenge mode.

### Phase 2 — Smart features · complete
PRs and non-gym records, habits, supplements, weekly reviews, timeline, calendar,
achievements, fitness phases, smart progression, goal prediction, notification
preferences, dashboard customisation, friend leaderboard.

### Phase 3 — AI · complete, two tiers
1. **Local analysis, always on.** Reads the log and answers progress, weight-stall,
   protein, calorie, training, sleep, step and next-workout questions with the
   user's own numbers. No key, no network, no latency.
2. **Optional model.** An Anthropic API key in Settings adds open conversation,
   passing the same log digest as context.

Tier 1 is the default on purpose: an app that can only coach when a key is present
fails the "use the user's logged data" requirement on day one.

### Phase 4 — Voice coach · not built, not blocking
Per §37–38 this is explicitly optional and must not be a dependency. Nothing in the
schema or architecture references voice. When it is added it reads `WorkoutSession`,
`SetEntry` and `PersonalRecord` and speaks them — no core rebuild required.

### Deliberately not built (§43)
Body measurements · data import · CSV export · PDF export · user-facing admin mode ·
full offline system · mandatory login · voice coach as a core requirement.

> The service worker caches the app shell so a cold launch paints instantly. That is
> not the "full offline system" §43 excludes — all data already lives on-device, and
> network requests pass straight through.

---

## Quality floor

Verified by driving the built app in a real browser:

- **Zero console errors** across the full onboarding → log → review walkthrough.
- **No horizontal overflow** at 320px, 390px, 768px, 1024px and 1440px.
- **Every touch target ≥ 44px**, audited across eight routes.
- **Visible keyboard focus** on every interactive element (2px kiln ring, never removed).
- **`prefers-reduced-motion` respected** — animations collapse to 0.01ms.
- **Both themes tested independently**, not inferred from one.
- **Backup round-trip verified**: save → erase everything → restore → data intact.
- Charts carry a legend, a hover/tap layer and a table view; no chart relies on
  colour alone; there are no dual-axis charts anywhere.

### Known limits

- **Friend leaderboard numbers are manual.** No backend in V1.
- **Notification preferences are stored but not scheduled.** Wiring them to the
  service worker's `showNotification` needs a scheduling strategy that survives a
  closed PWA; the preference model and permission prompt are in place for it.
- **The browser API-key path exposes the key to anything on the page.** Settings says
  so. A server-side proxy is the right fix if this ships publicly.
- **The food database is seeded, not exhaustive.** Users can add custom foods; a
  barcode scanner or a remote database would be the next step.
