/* ============================================================================
   Progress photos. Private by default (spec §21).

   Privacy is structural, not a setting buried in a menu: the blobs live in
   IndexedDB on the device, nothing is uploaded, and `shared` defaults to false on
   every photo. The banner says so in plain words because a user handing their
   phone to a trainer deserves to know where these live.

   Comparison is a draggable slider over two photos of the same angle. Object URLs
   are created on mount and revoked on unmount, so a 90-day photo set never leaks
   memory.
   ========================================================================= */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, Lock, Plus, Trash2 } from 'lucide-react'
import type { PhotoAngle, ProgressPhoto } from '../lib/types'
import { getBlob } from '../lib/db'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { shrinkImage } from '../lib/sync'
import { useT } from '../lib/i18n'
import { makeFmt } from '../lib/units'
import { daysBetween, fmtDate, today } from '../lib/date'
import { ConfirmSheet, Empty, ScreenHeader, Sheet, useToast } from '../components/ui'

const ANGLES: PhotoAngle[] = ['front', 'side', 'back']

/** Resolves a blobKey to an object URL and revokes it on unmount. */
function usePhotoUrl(blobKey: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blobKey) {
      setUrl(null)
      return
    }
    let revoked = false
    let created: string | null = null

    getBlob(blobKey)
      .then((blob) => {
        if (!blob || revoked) return
        created = URL.createObjectURL(blob)
        setUrl(created)
      })
      .catch(() => setUrl(null))

    return () => {
      revoked = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [blobKey])

  return url
}

export default function Photos() {
  const { t, locale } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!
  const fmt = useMemo(() => makeFmt(profile.units), [profile.units])

  const auth = useAuth()
  const [angle, setAngle] = useState<PhotoAngle>('front')
  const [mode, setMode] = useState<'timeline' | 'compare'>('timeline')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<ProgressPhoto | null>(null)

  const forAngle = useMemo(
    () => data.photos.filter((p) => p.angle === angle).sort((a, b) => (a.date < b.date ? -1 : 1)),
    [data.photos, angle],
  )

  return (
    <div className="shell">
      <ScreenHeader
        title={t('photos.title')}
        back="/progress"
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label={t('photos.add')}
            onClick={() => setAdding(true)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        }
      />

      {/* The honest version of this banner depends on whether an account is
          connected. Claiming "nothing is uploaded" while photos sync to a
          server would be the single worst lie this app could tell. */}
      <p className="ph-privacy">
        <Lock size={13} aria-hidden="true" />
        <span>
          <strong>{t('photos.private')}.</strong>{' '}
          {auth.user
            ? `Stored on this device and in your private account (${auth.user.email}). Only you can see them — they are never part of the friend leaderboard.`
            : t('photos.private.body')}
        </span>
      </p>

      <div className="hscroll" style={{ marginTop: 'var(--s-3)' }}>
        {ANGLES.map((a) => (
          <button
            key={a}
            type="button"
            className="chip"
            aria-pressed={angle === a}
            onClick={() => setAngle(a)}
          >
            {t(`photos.${a}`)}
            <span className="num ph-count">
              {data.photos.filter((p) => p.angle === a).length}
            </span>
          </button>
        ))}
      </div>

      {forAngle.length === 0 ? (
        <Empty
          icon={<Camera size={26} aria-hidden="true" />}
          title={t('photos.empty')}
          body={t('photos.empty.body')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
              <Plus size={15} aria-hidden="true" />
              {t('photos.add')}
            </button>
          }
        />
      ) : (
        <>
          <div className="segmented" style={{ marginTop: 'var(--s-4)' }}>
            <button
              type="button"
              aria-selected={mode === 'timeline'}
              onClick={() => setMode('timeline')}
            >
              {t('photos.timeline')}
            </button>
            <button
              type="button"
              aria-selected={mode === 'compare'}
              onClick={() => setMode('compare')}
              disabled={forAngle.length < 2}
            >
              {t('photos.compare')}
            </button>
          </div>

          {mode === 'compare' && forAngle.length >= 2 ? (
            <Compare photos={forAngle} />
          ) : (
            <ul className="ph-grid">
              {forAngle
                .slice()
                .reverse()
                .map((p) => (
                  <li key={p.id}>
                    <PhotoCard
                      photo={p}
                      startDate={profile.createdAt}
                      weightLabel={p.weightKg ? fmt.weightLabel(p.weightKg) : null}
                      locale={locale}
                      onDelete={() => setDeleting(p)}
                      onToggleShare={() =>
                        actions.updatePhoto(p.id, { shared: !p.shared })
                      }
                      shareLabel={t('photos.share')}
                    />
                  </li>
                ))}
            </ul>
          )}
        </>
      )}

      {adding && <AddPhotoSheet angle={angle} onClose={() => setAdding(false)} />}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void actions.deletePhoto(deleting.id)
          toast.show('Photo deleted')
        }}
        title="Delete this photo?"
        body={
          auth.user
            ? 'The image is removed from this device and from your account on the next sync. This cannot be undone.'
            : 'The image file is removed from this device. This cannot be undone.'
        }
      />

      <style>{`
        .ph-privacy {
          display: flex; align-items: flex-start; gap: var(--s-2);
          margin-top: var(--s-4); padding: var(--s-3);
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
          font-size: var(--fs-tiny); color: var(--text-2); line-height: 1.5;
        }
        .ph-privacy strong { color: var(--text-1); }
        .ph-count {
          font-size: var(--fs-micro); opacity: 0.6;
        }
        .ph-grid {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: var(--s-3); margin-top: var(--s-4);
        }
      `}</style>
    </div>
  )
}

/* ------------------------------- photo card ------------------------------- */

function PhotoCard({
  photo,
  startDate,
  weightLabel,
  locale,
  onDelete,
  onToggleShare,
  shareLabel,
}: {
  photo: ProgressPhoto
  startDate: string
  weightLabel: string | null
  locale: string
  onDelete: () => void
  onToggleShare: () => void
  shareLabel: string
}) {
  const url = usePhotoUrl(photo.blobKey)
  const dayNum = daysBetween(startDate, photo.date) + 1

  return (
    <figure className="pc">
      <div className="pc__frame">
        {url ? (
          <img src={url} alt={`${photo.angle} progress photo from ${fmtDate(photo.date, locale)}`} />
        ) : (
          <div className="pc__missing">
            <Camera size={20} aria-hidden="true" />
            <span>Image unavailable</span>
          </div>
        )}
        <span className="pc__day num">Day {dayNum}</span>
      </div>
      <figcaption className="pc__cap">
        <span className="pc__date num">{fmtDate(photo.date, locale)}</span>
        {weightLabel && <span className="pc__weight num">{weightLabel}</span>}
      </figcaption>
      <div className="pc__actions">
        <button
          type="button"
          className="pc__share"
          aria-pressed={photo.shared}
          onClick={onToggleShare}
          title={shareLabel}
        >
          {photo.shared ? 'Shareable' : 'Private'}
        </button>
        <button type="button" className="pc__del" aria-label="Delete photo" onClick={onDelete}>
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>

      <style>{`
        .pc { margin: 0; }
        .pc__frame {
          position: relative;
          aspect-ratio: 3 / 4;
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
          overflow: hidden;
        }
        .pc__frame img { width: 100%; height: 100%; object-fit: cover; }
        .pc__missing {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 6px; height: 100%;
          font-size: var(--fs-micro); color: var(--text-3);
        }
        .pc__day {
          position: absolute; left: 6px; top: 6px;
          padding: 2px 7px;
          background: rgb(5 6 7 / 0.7);
          backdrop-filter: blur(4px);
          border-radius: var(--r-pill);
          font-size: var(--fs-micro); font-weight: 500;
          color: #f3f0ea;
        }
        .pc__cap {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: var(--s-2); margin-top: 6px;
        }
        .pc__date { font-size: var(--fs-tiny); color: var(--text-2); }
        .pc__weight { font-size: var(--fs-tiny); color: var(--kiln-4); }
        .pc__actions {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 2px;
        }
        .pc__share {
          min-height: 32px; padding: 0 2px;
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--text-3);
        }
        .pc__share[aria-pressed='true'] { color: var(--warn); }
        .pc__del {
          display: grid; place-items: center;
          width: 32px; height: 32px;
          border-radius: var(--r-sm); color: var(--text-3);
        }
        .pc__del:hover { background: var(--critical-soft); color: var(--critical); }
      `}</style>
    </figure>
  )
}

/* -------------------------------- compare -------------------------------- */

function Compare({ photos }: { photos: ProgressPhoto[] }) {
  const { locale } = useT()
  const { data } = useStore()
  const profile = data.profile!
  const fmt = makeFmt(profile.units)

  const [leftIdx, setLeftIdx] = useState(0)
  const [rightIdx, setRightIdx] = useState(photos.length - 1)
  const [split, setSplit] = useState(50)

  const left = photos[leftIdx]
  const right = photos[rightIdx]
  const leftUrl = usePhotoUrl(left?.blobKey ?? null)
  const rightUrl = usePhotoUrl(right?.blobKey ?? null)

  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  function moveTo(clientX: number) {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setSplit(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)))
  }

  const gap = daysBetween(left.date, right.date)
  const weightDelta =
    left.weightKg != null && right.weightKg != null ? right.weightKg - left.weightKg : null

  return (
    <div className="cmp">
      <div
        ref={trackRef}
        className="cmp__stage"
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          moveTo(e.clientX)
        }}
        onPointerMove={(e) => {
          if (dragging.current) moveTo(e.clientX)
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
      >
        {rightUrl && <img className="cmp__after" src={rightUrl} alt={`After: ${fmtDate(right.date, locale)}`} />}
        {leftUrl && (
          <img
            className="cmp__before"
            src={leftUrl}
            alt={`Before: ${fmtDate(left.date, locale)}`}
            style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
          />
        )}

        <div className="cmp__handle" style={{ left: `${split}%` }} aria-hidden="true">
          <span className="cmp__grip">
            <ChevronLeft size={13} />
            <ChevronRight size={13} />
          </span>
        </div>

        <span className="cmp__tagL num">{fmtDate(left.date, locale)}</span>
        <span className="cmp__tagR num">{fmtDate(right.date, locale)}</span>
      </div>

      {/* Keyboard- and screen-reader-accessible equivalent of the drag. */}
      <label className="cmp__slider">
        <span className="sr-only">Comparison position</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(split)}
          onChange={(e) => setSplit(Number(e.target.value))}
          aria-label="Drag to reveal the before photo"
        />
      </label>

      <div className="cmp__meta">
        <span className="num">{gap} days apart</span>
        {weightDelta != null && (
          <span className="num" style={{ color: weightDelta <= 0 ? 'var(--good)' : 'var(--warn)' }}>
            {weightDelta > 0 ? '+' : ''}
            {fmt.weight(weightDelta)} {fmt.weightUnit}
          </span>
        )}
      </div>

      <div className="cmp__pickers">
        <Picker
          label="Before"
          photos={photos}
          value={leftIdx}
          onChange={setLeftIdx}
          locale={locale}
        />
        <Picker
          label="After"
          photos={photos}
          value={rightIdx}
          onChange={setRightIdx}
          locale={locale}
        />
      </div>

      <style>{`
        .cmp { margin-top: var(--s-4); }
        .cmp__stage {
          position: relative;
          aspect-ratio: 3 / 4;
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-lg);
          overflow: hidden;
          cursor: ew-resize;
          touch-action: none;
          user-select: none;
        }
        .cmp__stage img {
          position: absolute; inset: 0;
          width: 100%; height: 100%; object-fit: cover;
        }
        .cmp__handle {
          position: absolute; top: 0; bottom: 0;
          width: 2px; background: var(--chalk, #f3f0ea);
          transform: translateX(-1px);
          pointer-events: none;
        }
        .cmp__grip {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          display: flex; align-items: center;
          width: 34px; height: 34px;
          border-radius: 50%;
          background: rgb(5 6 7 / 0.78);
          backdrop-filter: blur(4px);
          color: #f3f0ea;
          justify-content: center;
        }
        .cmp__tagL, .cmp__tagR {
          position: absolute; bottom: 8px;
          padding: 2px 8px;
          background: rgb(5 6 7 / 0.7);
          backdrop-filter: blur(4px);
          border-radius: var(--r-pill);
          font-size: var(--fs-micro); color: #f3f0ea;
          pointer-events: none;
        }
        .cmp__tagL { left: 8px; }
        .cmp__tagR { right: 8px; }

        .cmp__slider { display: block; margin-top: var(--s-3); }
        .cmp__slider input {
          width: 100%; height: 44px;
          accent-color: var(--ember);
        }

        .cmp__meta {
          display: flex; align-items: center; justify-content: space-between;
          font-size: var(--fs-tiny); color: var(--text-3);
          margin-bottom: var(--s-4);
        }
        .cmp__pickers { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); }
      `}</style>
    </div>
  )
}

function Picker({
  label,
  photos,
  value,
  onChange,
  locale,
}: {
  label: string
  photos: ProgressPhoto[]
  value: number
  onChange: (i: number) => void
  locale: string
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select
        className="select"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {photos.map((p, i) => (
          <option key={p.id} value={i}>
            {fmtDate(p.date, locale)}
          </option>
        ))}
      </select>
    </label>
  )
}

/* ------------------------------- add photo ------------------------------- */

function AddPhotoSheet({ angle, onClose }: { angle: PhotoAngle; onClose: () => void }) {
  const { t } = useT()
  const { data, actions } = useStore()
  const auth = useAuth()
  const toast = useToast()
  const profile = data.profile!
  const fmt = makeFmt(profile.units)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [chosenAngle, setChosenAngle] = useState<PhotoAngle>(angle)
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latestWeight = [...data.weights].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1)?.kg

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function save() {
    if (!file) {
      setError('Pick a photo first.')
      return
    }
    setSaving(true)
    try {
      // Downscale before it is ever stored: a raw camera file is 3-6 MB, and
      // 90 days of three angles would blow past the device quota and the
      // server's. 1280px is still more than enough to see a change.
      await actions.addPhoto(await shrinkImage(file), chosenAngle, date, latestWeight)
      toast.show('Photo saved to this device', { tone: 'good' })
      onClose()
    } catch {
      setError('That photo could not be saved. Your device storage may be full.')
      setSaving(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('photos.add')}
      tall
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block btn--lg"
          onClick={save}
          disabled={saving || !file}
        >
          {saving ? 'Saving…' : t('common.save')}
        </button>
      }
    >
      <div className="stack-4">
        <label className="ap-drop">
          {preview ? (
            <img src={preview} alt="Selected photo preview" />
          ) : (
            <span className="ap-dropInner">
              <Camera size={26} aria-hidden="true" />
              <span className="ap-dropLabel">Choose a photo</span>
              <span className="ap-dropHint">Or take one now</span>
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setError(null)
            }}
          />
        </label>

        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Angle</legend>
          <div className="chips" style={{ marginTop: 'var(--s-2)' }}>
            {ANGLES.map((a) => (
              <button
                key={a}
                type="button"
                className="chip"
                aria-pressed={chosenAngle === a}
                onClick={() => setChosenAngle(a)}
              >
                {t(`photos.${a}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span className="field__label">Date</span>
          <input
            className="input"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        {latestWeight != null && (
          <p className="field__hint" style={{ marginTop: 0 }}>
            Your latest weigh-in ({fmt.weightLabel(latestWeight)}) is stamped on the photo so the
            comparison can show the change.
          </p>
        )}

        <p className="ap-privacy">
          <Lock size={12} aria-hidden="true" />
          {auth.user
            ? 'Saved to this device and your private account. Resized to 1280px first.'
            : 'Saved to this device only. Nothing is uploaded.'}
        </p>
      </div>

      <style>{`
        .ap-drop {
          display: block;
          aspect-ratio: 3 / 4;
          background: var(--surface-2);
          border: 1px dashed var(--hairline-strong);
          border-radius: var(--r-lg);
          overflow: hidden;
          cursor: pointer;
        }
        .ap-drop img { width: 100%; height: 100%; object-fit: cover; }
        .ap-dropInner {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: var(--s-2); height: 100%;
          color: var(--text-3);
        }
        .ap-dropLabel {
          font-family: var(--font-display);
          font-size: var(--fs-sm); font-weight: 700;
          color: var(--text-1);
        }
        .ap-dropHint { font-size: var(--fs-tiny); }
        .ap-privacy {
          display: flex; align-items: center; gap: 5px;
          font-size: var(--fs-tiny); color: var(--text-3);
        }
      `}</style>
    </Sheet>
  )
}
