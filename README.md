# Forge — Personal Fitness Transformation System

A mobile-first, local-first PWA that keeps a complete fitness journey in one log:
weight, training, nutrition, cardio, sleep, habits, photos, goals, challenges and
analytics.

**Core principle:** minimum input → maximum useful feedback. The user types a
weight, a few sets and a meal; the app derives trend lines, goal predictions,
personal records, progression suggestions, streaks and a daily score.

```bash
npm install
npm run dev        # API :3001 + client :5180, proxied so it is one origin
npm run build      # typecheck + production build
npm test           # merge-engine tests
npm start          # production: one process serving API + client
```

Runs with **no configuration at all** — local-first, no account. Copy
`.env.example` to `.env` and add a Neon URL only when you want accounts and
multi-device sync.

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

**Photos are private by default**, structurally: `shared` defaults to false and
the blobs live on-device. Once an account is connected they also sync to that
account and nowhere else, and the on-screen banner changes to say so — claiming
"nothing is uploaded" while photos travel to a server would be the worst lie
this app could tell.

**The friend board is still a local scorecard**, even though a backend now
exists. Sharing between accounts needs its own privacy model — §34 forbids
exposing body data — and that is a separate design problem from sync. So you
type your friends' numbers, and only consistency metrics are rankable.

**Backup still matters even with an account.** No mandatory login (§42), so a
signed-out user's identity is a random `deviceId` minted on first run and
carried inside the backup file. The file contains everything including photos as
base64 — a backup that silently drops the day-one photo is not a backup. With an
account it stops being the *only* copy, but it is still the one that works when
the server is gone.

---

---

## Accounts & sync (optional)

The app is local-first and stays that way. An account adds durability and a
second device; it is never a gate. With no `DATABASE_URL` the server reports
`sync: false`, the Account screen explains why, and every feature still works.

### Why local-first + sync, rather than a server database

Three constraints ruled out making Neon the primary store:

1. **No mandatory login (§42).** A server store needs to know whose rows are
   whose. Keying on a device id instead would mean anyone who guessed one could
   read someone's weight history and progress photos.
2. **The browser cannot hold a connection string.** Anything shipped to the
   client is readable, so a direct Neon connection would publish the database.
3. **The gym has no signal.** Logging a set must not wait on a round trip.

So IndexedDB stays the source of truth and the server is a sync target.

### The shape of it

```
IndexedDB (truth)  ──►  /api/sync  ──►  Neon  (one jsonb row per account)
   instant, offline       JWT auth        durable, multi-device
        ▲                                        │
        └──────── pull + merge on the other device ◄──┘
```

One row per user, the whole document in `jsonb`. Nothing server-side queries
inside it, so there is no reason to model sets and meals relationally.

### Merging, and why it is the hard part

Two devices edit offline; when they meet, something must decide what the log
contains. Both naive answers lose data — last-writer-wins discards the other
device's week, and a plain union resurrects everything you deleted.

`src/lib/merge.ts` is a per-collection merge with three rules: union by id,
later `updatedAt` wins a collision, and a tombstone kills a record if the
deletion happened after that record's last write. It is **commutative,
idempotent and lossless**, and `merge.test.ts` asserts exactly that — those
properties are what stop "my phone keeps undoing my laptop".

Pushes use optimistic concurrency: the server accepts a write only if the
client's `baseRev` still matches, otherwise it returns 409 with the current
document so the client can merge and retry. The server never merges — one
implementation of that logic is hard enough to keep correct.

### Security

| | |
|---|---|
| Passwords | bcrypt, cost 12 |
| Access token | 15-minute JWT, **in memory only** — never localStorage, so XSS cannot read it |
| Refresh token | opaque, httpOnly `SameSite=Lax` cookie, stored hashed, **rotated on every use** |
| Token replay | a spent refresh token revokes its entire family |
| Login | one error message for unknown-email and wrong-password, so accounts cannot be enumerated |
| Rate limit | 20 attempts / 15 min per IP on auth routes |
| CORS | none needed — API and client are same-origin by design |
| Secrets | the server refuses to boot in production without `JWT_SECRET` |

### Photos

Downscaled to 1280px / JPEG q0.82 **before they are ever stored** — a raw camera
file is 3–6 MB, and 90 days of three angles would blow past both the device
quota and Neon's. They land around 150 KB.

They sync as a set difference against `/api/photos`, not through the merge, and
are capped by `PHOTO_QUOTA_BYTES` (200 MB ≈ 1,300 photos). Storing blobs in
Postgres is a deliberate trade for a one-service deployment; swap the `photos`
table for S3/R2 presigned URLs when that stops being true.

### Deploying

**One host (recommended).** `npm run build && npm start` — Express serves the
API and `dist/` on the same origin, which is what keeps the refresh cookie
working with no CORS.

**Vercel.** `api/index.js` is the serverless entry; Vercel serves `dist/`
itself. Set `DATABASE_URL` and `JWT_SECRET` in the project settings.

**Static only.** Deploy `dist/` anywhere. No API, no accounts — a fully
supported configuration, not a degraded one.

Serve over HTTPS or the service worker will not register, and add a SPA rewrite
so `/analytics` resolves to `index.html`.

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

### Accounts & sync · complete
Optional email/password accounts on Neon, conflict-free document merge with
tombstones, photo sync with client-side downscaling, and full anonymous
operation when no database is configured.

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

Sync is verified by driving **two independent browser profiles** against a live
API (16 checks, all passing, zero console errors):

- data logged before signing up is uploaded, not replaced
- a second device pulls the first device's history on sign-in
- concurrent edits on both devices converge to the same document
- a deletion on one device is not resurrected by the other
- built-in programmes survive a merge
- repeated syncs do not keep bumping the revision (no push ping-pong)
- with no API at all, onboarding and logging still work end to end

### Known limits

- **No password reset.** There is no mail sender wired up, so a forgotten
  password means the account is unreachable — the backup file is the fallback.
  This is the first thing to add if this ships to anyone but you.
- **Friend leaderboard numbers are manual.** The sync layer exists now, but
  sharing between accounts would need its own privacy model (§34 forbids
  exposing body data), so it was left as a local scorecard.
- **Rate limiting is in-memory.** Correct for one instance; move it to Redis
  before scaling out, or each instance gets its own allowance.
- **Notification preferences are stored but not scheduled.** Wiring them to the
  service worker's `showNotification` needs a scheduling strategy that survives a
  closed PWA; the preference model and permission prompt are in place for it.
- **The browser API-key path exposes the key to anything on the page.** Settings says
  so. A server-side proxy is the right fix if this ships publicly.
- **The food database is seeded, not exhaustive.** Users can add custom foods; a
  barcode scanner or a remote database would be the next step.
