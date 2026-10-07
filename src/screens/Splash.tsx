/* ============================================================================
   Splash. Shown only while the document hydrates from IndexedDB, which is tens
   of milliseconds — so it is a held frame, not an animation sequence. The ring
   is drawn mid-stroke so the brand mark is recognisable the instant it appears.
   ========================================================================= */

export function Splash() {
  return (
    <div className="splash">
      <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">
        <circle cx="32" cy="32" r="19" fill="none" stroke="var(--hairline)" strokeWidth="6" />
        <path
          d="M32 13a19 19 0 0 1 16.45 28.5"
          fill="none"
          stroke="var(--kiln-4)"
          strokeWidth="6"
          strokeLinecap="round"
          className="splash__arc"
        />
        <path
          d="M48.45 41.5A19 19 0 0 1 32 51"
          fill="none"
          stroke="var(--kiln-2)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="32" cy="32" r="6" fill="var(--ember)" />
      </svg>
      <p className="splash__name">Forge</p>
      <p className="splash__sub">Transformation log</p>
      <span className="sr-only" role="status">
        Loading your log
      </span>

      <style>{`
        .splash {
          min-height: 100dvh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: var(--s-2);
          background: var(--ink);
        }
        .splash__name {
          margin-top: var(--s-4);
          font-family: var(--font-display);
          font-size: var(--fs-2xl); font-weight: 800;
          letter-spacing: var(--tr-display);
        }
        .splash__sub {
          font-family: var(--font-display);
          font-size: var(--fs-micro); font-weight: 700;
          letter-spacing: var(--tr-eyebrow); text-transform: uppercase;
          color: var(--text-3);
        }
        .splash__arc {
          transform-origin: 32px 32px;
          animation: splash-spin 1.6s var(--ease-out) infinite;
        }
        @keyframes splash-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .splash__arc { animation: none; }
        }
      `}</style>
    </div>
  )
}
