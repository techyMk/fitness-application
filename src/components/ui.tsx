/* ============================================================================
   Shared UI primitives. Deliberately small: a sheet, a screen header, a stat
   readout, a meter, a number stepper, a toast. Everything else is composed from
   base.css classes in the screens themselves.
   ========================================================================= */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ChevronLeft, Minus, Plus, X, AlertCircle, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/* ================================= header =============================== */

export function ScreenHeader({
  title,
  subtitle,
  back,
  action,
  sticky = true,
}: {
  title: string
  subtitle?: string
  /** explicit path, or true for history back */
  back?: string | true
  action?: ReactNode
  sticky?: boolean
}) {
  const navigate = useNavigate()
  return (
    <header className={`scr-head${sticky ? ' scr-head--sticky' : ''}`}>
      {back && (
        <button
          type="button"
          className="icon-btn"
          aria-label="Go back"
          onClick={() => (back === true ? navigate(-1) : navigate(back))}
        >
          <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
      <div className="grow">
        <h1 className="scr-head__title">{title}</h1>
        {subtitle && <p className="scr-head__sub">{subtitle}</p>}
      </div>
      {action}

      <style>{`
        .scr-head {
          display: flex; align-items: center; gap: var(--s-2);
          padding: calc(var(--safe-t) + var(--s-4)) 0 var(--s-3);
          margin-inline: calc(var(--s-4) * -1);
          padding-inline: var(--s-4);
        }
        .scr-head--sticky {
          position: sticky; top: 0; z-index: var(--z-sticky);
          background: var(--ink);
          border-bottom: 1px solid var(--hairline);
        }
        .scr-head__title {
          font-size: var(--fs-xl); font-weight: 800;
          letter-spacing: var(--tr-display);
        }
        .scr-head__sub {
          font-size: var(--fs-tiny); color: var(--text-3);
          margin-top: 1px;
        }
      `}</style>
    </header>
  )
}

/* ================================== sheet ===============================
   Bottom sheet. Rises from the bottom (hierarchy: a sheet is "deeper", so it
   enters from below), dismisses on scrim tap, Escape, and the explicit close
   button. Focus is trapped while open and returned on close.
   ====================================================================== */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  /** tall sheets (food search) get the full viewport minus a peek of context */
  tall = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  tall?: boolean
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreTo.current = document.activeElement as HTMLElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    // Focus the panel itself, not the first control — autofocusing an input pops
    // the mobile keyboard before the user has seen the sheet.
    const id = window.setTimeout(() => panelRef.current?.focus(), 30)

    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      window.clearTimeout(id)
      restoreTo.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="sheet-root">
      <div className="sheet__scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={`sheet__panel${tall ? ' sheet__panel--tall' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="sheet__grip" aria-hidden="true" />
        <div className="sheet__head">
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </div>

      <style>{`
        .sheet-root { position: fixed; inset: 0; z-index: var(--z-sheet); }
        .sheet__scrim {
          position: absolute; inset: 0;
          background: var(--scrim);
          backdrop-filter: blur(2px);
          animation: fade var(--t-mid) var(--ease-out) both;
        }
        .sheet__panel {
          position: absolute; left: 0; right: 0; bottom: 0;
          max-width: var(--col); margin-inline: auto;
          max-height: 90dvh;
          display: flex; flex-direction: column;
          background: var(--surface-1);
          border: 1px solid var(--hairline);
          border-bottom: 0;
          border-radius: var(--r-xl) var(--r-xl) 0 0;
          animation: sheet-in var(--t-mid) var(--ease-out) both;
        }
        .sheet__panel--tall { height: 90dvh; }
        .sheet__grip {
          width: 36px; height: 4px; border-radius: 2px;
          background: var(--hairline-strong);
          margin: var(--s-2) auto 0;
        }
        .sheet__head {
          display: flex; align-items: center; gap: var(--s-2);
          padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4);
        }
        .sheet__title {
          flex: 1; font-size: var(--fs-lg); font-weight: 700;
          letter-spacing: var(--tr-display);
        }
        .sheet__body {
          flex: 1; overflow-y: auto;
          padding: 0 var(--s-4) var(--s-4);
          -webkit-overflow-scrolling: touch;
        }
        .sheet__foot {
          padding: var(--s-3) var(--s-4) calc(var(--s-4) + var(--safe-b));
          border-top: 1px solid var(--hairline);
          background: var(--surface-1);
        }
      `}</style>
    </div>
  )
}

/* ================================ confirm =============================== */

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Delete',
  destructive = true,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: string
  confirmLabel?: string
  destructive?: boolean
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
        {body}
      </p>
      <div className="row" style={{ marginTop: 'var(--s-5)', gap: 'var(--s-2)' }}>
        <button type="button" className="btn btn--ghost grow" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn grow ${destructive ? 'btn--danger' : 'btn--primary'}`}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  )
}

/* ================================== stat ================================
   A labelled number. The number wears the data face; the unit is a separate,
   smaller element so "71.4 kg" aligns on the decimal across a row of stats.
   ====================================================================== */

export function Stat({
  label,
  value,
  unit,
  tone = 'default',
  size = 'md',
  hint,
}: {
  label: string
  value: string | number
  unit?: string
  tone?: 'default' | 'good' | 'warn' | 'critical' | 'ember' | 'dim'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  hint?: string
}) {
  const colour = {
    default: 'var(--text-1)',
    good: 'var(--good)',
    warn: 'var(--warn)',
    critical: 'var(--critical)',
    ember: 'var(--ember)',
    dim: 'var(--text-3)',
  }[tone]

  const fs = {
    sm: 'var(--fs-base)',
    md: 'var(--fs-xl)',
    lg: 'var(--fs-2xl)',
    xl: 'var(--fs-3xl)',
  }[size]

  return (
    <div className="stat">
      <span className="t-micro stat__label">{label}</span>
      <span className="stat__value num" style={{ fontSize: fs, color: colour }}>
        {value}
        {unit && <span className="t-unit stat__unit">{unit}</span>}
      </span>
      {hint && <span className="stat__hint">{hint}</span>}

      <style>{`
        .stat { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        /* Labels wear uppercase + wide tracking, which makes them long. In a
           tight grid column they must break rather than run into the next
           stat, and "anywhere" because the tracking defeats word breaks. */
        .stat__label {
          color: var(--text-3);
          overflow-wrap: anywhere;
          line-height: 1.25;
        }
        .stat__value {
          font-weight: 600; line-height: 1.1;
          display: flex; align-items: baseline; gap: 3px;
        }
        .stat__unit { font-weight: 500; }
        .stat__hint { font-size: var(--fs-tiny); color: var(--text-3); }
      `}</style>
    </div>
  )
}

/* ================================= meter ===============================
   A linear progress bar. Colour comes from the kiln ramp by default so a meter
   and the ring report the same temperature for the same completion. `tone`
   overrides it for the cases where fill has a fixed meaning (a macro's series
   colour), and `over` paints the overshoot in the warning colour instead of
   silently clamping — eating 2,900 of a 2,200 target must look different from
   hitting it exactly.
   ====================================================================== */

export function Meter({
  value,
  max,
  label,
  tone,
  showOver = true,
  height = 8,
}: {
  value: number
  max: number
  label?: string
  tone?: string
  showOver?: boolean
  height?: number
}) {
  const ratio = max > 0 ? value / max : 0
  const pct = Math.min(100, ratio * 100)
  const over = showOver && ratio > 1.05
  const fill = tone ?? kilnFor(ratio)

  return (
    <div className="meter">
      {label && <span className="sr-only">{label}</span>}
      <div
        className="meter__track"
        style={{ height }}
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(max)}
        aria-label={label}
      >
        <div
          className="meter__fill"
          style={{ width: `${pct}%`, background: over ? 'var(--warn)' : fill }}
        />
      </div>

      <style>{`
        .meter__track {
          width: 100%; border-radius: var(--r-pill);
          background: var(--surface-inset);
          overflow: hidden;
        }
        .meter__fill {
          height: 100%; border-radius: var(--r-pill);
          transition: width var(--t-slow) var(--ease-out), background-color var(--t-mid) var(--ease-out);
        }
      `}</style>
    </div>
  )
}

export function kilnFor(ratio: number): string {
  if (ratio >= 0.95) return 'var(--kiln-5)'
  if (ratio >= 0.75) return 'var(--kiln-4)'
  if (ratio >= 0.5) return 'var(--kiln-3)'
  if (ratio >= 0.25) return 'var(--kiln-2)'
  return 'var(--kiln-1)'
}

/* ============================= number stepper ===========================
   The core logging control. A bare number input on mobile means summoning the
   keyboard, which is the single biggest tax on "log a set in a few seconds". So
   it pairs a tabular readout with ±step buttons sized for a thumb, and the input
   itself stays reachable for a big jump.
   ====================================================================== */

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  label,
  unit,
  decimals = 0,
  id,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  label: string
  unit?: string
  decimals?: number
  id?: string
}) {
  const inputId = id ?? useId()
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string) => {
    const n = Number.parseFloat(raw.replace(',', '.'))
    setDraft(null)
    if (Number.isFinite(n)) onChange(clamp(round(n, decimals)))
  }

  return (
    <div className="step">
      <label className="t-micro step__label" htmlFor={inputId}>
        {label}
        {unit && <span className="step__unit"> {unit}</span>}
      </label>
      <div className="step__row">
        <button
          type="button"
          className="step__btn"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(round(value - step, decimals)))}
          disabled={value <= min}
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <input
          id={inputId}
          className="step__input num"
          type="text"
          inputMode="decimal"
          value={draft ?? (decimals ? value.toFixed(decimals) : String(value))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="step__btn"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(round(value + step, decimals)))}
          disabled={value >= max}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      <style>{`
        .step { display: flex; flex-direction: column; gap: var(--s-2); min-width: 0; }
        .step__label { color: var(--text-3); }
        .step__unit { color: var(--text-3); font-weight: 500; letter-spacing: 0.04em; }
        .step__row {
          display: flex; align-items: stretch;
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
          overflow: hidden;
        }
        .step__btn {
          width: 46px; flex: none;
          display: grid; place-items: center;
          color: var(--text-2);
          transition: background-color var(--t-fast) var(--ease-out);
        }
        .step__btn:hover:not(:disabled) { background: var(--surface-3); color: var(--text-1); }
        .step__btn:active:not(:disabled) { background: var(--ember-soft); color: var(--ember); }
        .step__btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .step__input {
          flex: 1; min-width: 0; width: 100%;
          height: 48px; padding: 0;
          background: transparent; border: 0;
          text-align: center;
          font-size: var(--fs-lg); font-weight: 500;
        }
        .step__input:focus { outline: none; background: var(--surface-3); }
      `}</style>
    </div>
  )
}

function round(n: number, dp: number) {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

/* ================================= toast ===============================
   One toast at a time, aria-live polite so it never steals focus. Supports an
   undo action, which is what makes deleting a set or a food safe enough to do
   without a confirm dialog.
   ====================================================================== */

interface ToastState {
  message: string
  tone: 'info' | 'good' | 'warn'
  action?: { label: string; run: () => void }
}

interface ToastApi {
  show: (message: string, opts?: Partial<Omit<ToastState, 'message'>>) => void
}

const ToastContext = createContext<ToastApi>({ show: () => {} })
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number>()

  const show = useCallback<ToastApi['show']>((message, opts) => {
    window.clearTimeout(timer.current)
    setToast({ message, tone: opts?.tone ?? 'info', action: opts?.action })
    // Longer window when there is something to undo — 4s is not enough to read
    // the message and decide.
    timer.current = window.setTimeout(() => setToast(null), opts?.action ? 6500 : 3500)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-slot" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className="toast" data-tone={toast.tone}>
            {toast.tone === 'good' ? (
              <Check size={16} aria-hidden="true" />
            ) : toast.tone === 'warn' ? (
              <AlertCircle size={16} aria-hidden="true" />
            ) : null}
            <span className="grow">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action!.run()
                  setToast(null)
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        .toast-slot {
          position: fixed; z-index: var(--z-toast);
          left: 0; right: 0;
          bottom: calc(var(--tabbar-h) + var(--safe-b) + var(--s-3));
          display: flex; justify-content: center;
          padding-inline: var(--s-4);
          pointer-events: none;
        }
        .toast {
          display: flex; align-items: center; gap: var(--s-2);
          width: 100%; max-width: calc(var(--col) - var(--s-8));
          padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4);
          background: var(--surface-3);
          border: 1px solid var(--hairline-strong);
          border-radius: var(--r-md);
          font-size: var(--fs-sm);
          box-shadow: 0 8px 28px rgb(0 0 0 / 0.38);
          pointer-events: auto;
          animation: rise var(--t-mid) var(--ease-out) both;
        }
        .toast[data-tone='good'] { color: var(--good); border-color: var(--good); }
        .toast[data-tone='warn'] { color: var(--warn); border-color: var(--warn); }
        .toast__action {
          flex: none; min-height: 36px; padding: 0 var(--s-3);
          border-radius: var(--r-sm);
          font-family: var(--font-display);
          font-size: var(--fs-tiny); font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--ember);
        }
        .toast__action:hover { background: var(--ember-soft); }
      `}</style>
    </ToastContext.Provider>
  )
}

/* ================================ empty ================================ */

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      {icon && <span className="empty__icon">{icon}</span>}
      <span className="empty__title">{title}</span>
      {body && <span className="empty__body">{body}</span>}
      {action}
    </div>
  )
}

/* ============================== list row =============================== */

export function Row({
  icon,
  title,
  meta,
  value,
  onClick,
  to,
  trailing,
}: {
  icon?: ReactNode
  title: string
  meta?: string
  value?: ReactNode
  onClick?: () => void
  to?: string
  trailing?: ReactNode
}) {
  const navigate = useNavigate()
  const interactive = !!onClick || !!to
  const Tag = interactive ? 'button' : 'div'

  return (
    <Tag
      {...(interactive ? { type: 'button' as const, onClick: onClick ?? (() => navigate(to!)) } : {})}
      className={`lrow${interactive ? ' lrow--tap pressable' : ''}`}
    >
      {icon && <span className="lrow__icon">{icon}</span>}
      <span className="lrow__text">
        <span className="lrow__title">{title}</span>
        {meta && <span className="lrow__meta">{meta}</span>}
      </span>
      {value && <span className="lrow__value num">{value}</span>}
      {trailing}

      <style>{`
        .lrow {
          display: flex; align-items: center; gap: var(--s-3);
          width: 100%; min-height: 56px;
          padding: var(--s-2) var(--s-1);
          text-align: left;
          border-radius: var(--r-sm);
        }
        .lrow--tap { cursor: pointer; }
        .lrow__icon {
          display: grid; place-items: center;
          width: 36px; height: 36px; flex: none;
          border-radius: var(--r-sm);
          background: var(--surface-2);
          color: var(--text-2);
        }
        .lrow__text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .lrow__title {
          font-size: var(--fs-sm); font-weight: 600; color: var(--text-1);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .lrow__meta { font-size: var(--fs-tiny); color: var(--text-3); }
        .lrow__value {
          flex: none; font-size: var(--fs-sm); font-weight: 500; color: var(--text-1);
        }
      `}</style>
    </Tag>
  )
}

/* ============================= rating scale ============================
   1–5 scale for check-in questions. Buttons, not a slider: a slider needs a
   drag and a precise landing, a row of five taps needs neither.
   ====================================================================== */

export function Scale({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string
  value: number | undefined
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void
  lowLabel: string
  highLabel: string
}) {
  const groupId = useId()
  return (
    <fieldset className="scale">
      <legend className="field__label" id={groupId}>
        {label}
      </legend>
      <div className="scale__row" role="radiogroup" aria-labelledby={groupId}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label}: ${n} of 5`}
            className="scale__btn num"
            data-on={value === n}
            onClick={() => onChange(n as 1 | 2 | 3 | 4 | 5)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="scale__ends">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>

      <style>{`
        .scale { border: 0; padding: 0; margin: 0; }
        .scale__row { display: flex; gap: var(--s-2); }
        .scale__btn {
          flex: 1; height: 48px;
          border-radius: var(--r-md);
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          color: var(--text-2);
          font-size: var(--fs-base); font-weight: 500;
          transition:
            background-color var(--t-fast) var(--ease-out),
            border-color var(--t-fast) var(--ease-out),
            color var(--t-fast) var(--ease-out);
        }
        .scale__btn[data-on='true'] {
          background: var(--ember-soft); border-color: var(--ember); color: var(--ember);
        }
        .scale__ends {
          display: flex; justify-content: space-between;
          margin-top: var(--s-2);
          font-size: var(--fs-tiny); color: var(--text-3);
        }
      `}</style>
    </fieldset>
  )
}
