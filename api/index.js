/* Vercel serverless entry.
 *
 * Vercel serves `dist/` as static files itself, so this handler only carries
 * the API. The schema is ensured once per cold start rather than per request —
 * `create table if not exists` is cheap, but not per-invocation cheap.
 */
import app, { initSchema, isConfigured } from '../server/app.js'

let ready = null

export default async function handler(req, res) {
  if (isConfigured && !ready) {
    ready = initSchema().catch((e) => {
      console.error('[schema]', e)
      ready = null // let the next cold start retry
    })
  }
  if (ready) await ready
  return app(req, res)
}
