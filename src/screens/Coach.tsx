/* ============================================================================
   AI coach (spec §36). Text only — the voice coach is explicitly Phase 4 and
   nothing here depends on it.

   Two tiers, in this order on purpose:
   1. Local analysis, always available. It reads the log and answers the common
      questions with the user's own numbers. No key, no network, no latency.
   2. An optional Anthropic API key for open conversation, with the same log
      digest passed as context so the model is never guessing either.

   Tier 1 is the default because an app that can only coach when a key is present
   fails the brief's "use the user's logged data rather than giving generic
   responses" requirement on day one.
   ========================================================================= */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, Cpu, Sparkles, Trash2 } from 'lucide-react'
import { answerLocally, buildContext, SUGGESTED_QUESTIONS } from '../lib/coach'
import { useStore } from '../lib/store'
import { useT } from '../lib/i18n'
import { ScreenHeader, useToast } from '../components/ui'

const KEY_STORE = 'forge:anthropic-key'
const MODEL = 'claude-sonnet-5'

export default function Coach() {
  const { t } = useT()
  const { data, actions } = useStore()
  const toast = useToast()
  const profile = data.profile!

  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [apiKey] = useState(() => {
    try {
      return localStorage.getItem(KEY_STORE) ?? ''
    } catch {
      return ''
    }
  })

  const logRef = useRef<HTMLDivElement>(null)
  const context = useMemo(() => buildContext(data), [data])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [data.coachLog.length, busy])

  async function send(question: string) {
    const text = question.trim()
    if (!text || busy) return

    setInput('')
    actions.appendCoach({ role: 'user', text })

    // Tier 1 — try the local analyst first. It is instant and it is specific.
    const local = answerLocally(data, text)
    if (local) {
      actions.appendCoach({ role: 'coach', text: local.text, local: true })
      return
    }

    // Tier 2 — a model, if the user connected one.
    if (!apiKey) {
      actions.appendCoach({
        role: 'coach',
        text: `I answer from your log, and I do not have a reading for that one. Try asking about your progress, weight trend, protein, calories, training frequency, sleep, steps, or what to do today.\n\nFor open conversation, connect a model in Settings.`,
        local: true,
      })
      return
    }

    setBusy(true)
    try {
      const reply = await askModel(apiKey, context.digest, text, profile.coaching)
      actions.appendCoach({ role: 'coach', text: reply })
    } catch (err) {
      actions.appendCoach({
        role: 'coach',
        text:
          err instanceof Error
            ? `That request failed: ${err.message}. Your log is unaffected — try again, or check the key in Settings.`
            : 'That request failed. Try again, or check the key in Settings.',
        local: true,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shell co">
      <ScreenHeader
        title={t('coach.title')}
        subtitle={apiKey ? 'Local analysis + connected model' : 'Reading your log'}
        back="/more"
        action={
          data.coachLog.length > 0 ? (
            <button
              type="button"
              className="icon-btn"
              aria-label="Clear conversation"
              onClick={() => {
                actions.clearCoach()
                toast.show('Conversation cleared')
              }}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          ) : undefined
        }
      />

      <div className="co-log" ref={logRef}>
        {data.coachLog.length === 0 ? (
          <div className="co-intro">
            <span className="co-introIcon">
              <Sparkles size={24} aria-hidden="true" />
            </span>
            <h2 className="co-introTitle">Ask about your own numbers</h2>
            <p className="co-introBody">
              Everything here is answered from what you have logged — your trend, your averages, your
              last sessions. Not generic advice.
            </p>
          </div>
        ) : (
          <ul className="co-msgs">
            {data.coachLog.map((m) => (
              <li key={m.id} className={`co-msg co-msg--${m.role}`}>
                <div className="co-bubble">
                  {m.text.split('\n\n').map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
                {m.role === 'coach' && m.local && (
                  <span className="co-source">{t('coach.local')}</span>
                )}
              </li>
            ))}
            {busy && (
              <li className="co-msg co-msg--coach">
                <div className="co-bubble co-bubble--typing" aria-live="polite">
                  <span className="co-dot" />
                  <span className="co-dot" />
                  <span className="co-dot" />
                  <span className="sr-only">Thinking</span>
                </div>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="co-suggest hscroll">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button key={q} type="button" className="chip" onClick={() => void send(q)} disabled={busy}>
            {q}
          </button>
        ))}
      </div>

      <form
        className="co-form"
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
      >
        <label className="sr-only" htmlFor="co-input">
          {t('coach.ask')}
        </label>
        <input
          id="co-input"
          className="co-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('coach.placeholder')}
          disabled={busy}
          maxLength={400}
        />
        <button
          type="submit"
          className="co-send"
          aria-label="Send"
          disabled={busy || !input.trim()}
        >
          <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </form>

      {!apiKey && (
        <p className="co-note">
          <Cpu size={13} aria-hidden="true" />
          <span>
            {t('coach.needKey.body')}{' '}
            <Link to="/settings" className="co-link">
              Open Settings
            </Link>
            .
          </span>
        </p>
      )}

      <style>{`
        .co { display: flex; flex-direction: column; min-height: 100dvh; }
        .co-log { flex: 1; overflow-y: auto; padding: var(--s-4) 0; }

        .co-intro {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: var(--s-2);
          padding: var(--s-10) var(--s-4);
        }
        .co-introIcon {
          display: grid; place-items: center;
          width: 52px; height: 52px;
          border-radius: 50%;
          background: var(--ember-soft);
          color: var(--ember);
          margin-bottom: var(--s-2);
        }
        .co-introTitle {
          font-size: var(--fs-lg); font-weight: 800;
          letter-spacing: var(--tr-display);
        }
        .co-introBody {
          font-size: var(--fs-sm); color: var(--text-2);
          max-width: 34ch; line-height: 1.55;
        }

        .co-msgs { display: flex; flex-direction: column; gap: var(--s-4); }
        .co-msg { display: flex; flex-direction: column; gap: 4px; }
        .co-msg--user { align-items: flex-end; }
        .co-msg--coach { align-items: flex-start; }
        .co-bubble {
          max-width: 88%;
          padding: var(--s-3) var(--s-4);
          border-radius: var(--r-lg);
          font-size: var(--fs-sm); line-height: 1.55;
        }
        .co-bubble > p + p { margin-top: var(--s-3); }
        .co-msg--user .co-bubble {
          background: var(--ember);
          color: var(--text-on-ember);
          border-bottom-right-radius: var(--r-sm);
          font-weight: 500;
        }
        .co-msg--coach .co-bubble {
          background: var(--surface-1);
          border: 1px solid var(--hairline);
          color: var(--text-1);
          border-bottom-left-radius: var(--r-sm);
        }
        .co-source {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--text-3);
          padding-left: var(--s-2);
        }

        .co-bubble--typing { display: flex; gap: 5px; align-items: center; }
        .co-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--text-3);
          animation: co-pulse 1.2s ease-in-out infinite;
        }
        .co-dot:nth-child(2) { animation-delay: 0.15s; }
        .co-dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes co-pulse {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }

        .co-suggest { padding: var(--s-2) var(--s-4) var(--s-3); }
        .co-suggest .chip { white-space: nowrap; min-height: 38px; font-size: var(--fs-tiny); }

        .co-form {
          position: sticky; bottom: 0;
          display: flex; align-items: center; gap: var(--s-2);
          padding-bottom: calc(var(--tabbar-h) + var(--safe-b) + var(--s-3));
          background: linear-gradient(180deg, transparent, var(--ink) 25%);
        }
        .co-input {
          flex: 1; min-width: 0; height: 50px;
          padding: 0 var(--s-4);
          background: var(--surface-2);
          border: 1px solid var(--hairline);
          border-radius: var(--r-pill);
          font-size: var(--fs-base);
        }
        .co-input:focus { outline: none; border-color: var(--ember); }
        .co-send {
          display: grid; place-items: center;
          width: 50px; height: 50px; flex: none;
          border-radius: 50%;
          background: var(--ember);
          color: var(--text-on-ember);
          transition: opacity var(--t-fast) var(--ease-out);
        }
        .co-send:disabled { opacity: 0.35; cursor: not-allowed; }

        .co-note {
          display: flex; align-items: flex-start; gap: 6px;
          padding-bottom: calc(var(--tabbar-h) + var(--safe-b) + var(--s-3));
          font-size: var(--fs-tiny); color: var(--text-3); line-height: 1.5;
        }
        .co-link { color: var(--ember); text-decoration: underline; }
      `}</style>
    </div>
  )
}

/* ============================== model call =============================== */

const SYSTEM = (tone: string) => `You are a strength and nutrition coach inside a personal fitness
tracking app. You are given the user's actual logged data. Rules:

- Ground every claim in the numbers you were given. If the data does not support an
  answer, say which log entry is missing instead of guessing.
- Be concrete. Give a number, a weight, a day — not "try to eat more protein".
- Never give medical advice, diagnose, or discuss disordered eating patterns; if the
  user raises a health concern, tell them to speak to a doctor.
- Two short paragraphs maximum. No bullet lists, no headings, no emoji.
- Tone: ${tone === 'direct' ? 'blunt and brief' : tone === 'gentle' ? 'warm and encouraging' : 'plain and matter-of-fact'}.`

async function askModel(
  apiKey: string,
  digest: string,
  question: string,
  tone: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Required for browser-origin calls to the Messages API.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM(tone),
      messages: [
        {
          role: 'user',
          content: `Here is my logged data:\n\n${digest}\n\nMy question: ${question}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('the key was rejected')
    if (res.status === 429) throw new Error('rate limited — wait a moment')
    throw new Error(`the service returned ${res.status}`)
  }

  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = json.content
    ?.filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('')
    .trim()

  if (!text) throw new Error('the reply was empty')
  return text
}

export { KEY_STORE }
