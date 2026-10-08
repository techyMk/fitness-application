import 'dotenv/config'
import app, { initSchema, isConfigured, pruneTokens, serveClient } from './app.js'

/* Local and single-host production entry. On Vercel, api/index.js is used. */

const PORT = Number(process.env.PORT || 3001)
const isProd = process.env.NODE_ENV === 'production'

// In production this process also serves the built client, which is what keeps
// the API same-origin with the app — no CORS, and the refresh cookie works.
// In dev, Vite serves the client on :5180 and proxies /api here.
if (isProd) serveClient()

async function start() {
  if (!isConfigured) {
    console.warn(
      '⚠️  DATABASE_URL is not set. The app runs fine without it —\n' +
        '    accounts and sync are simply disabled (see spec §42).',
    )
  } else {
    try {
      await initSchema()
      await pruneTokens()
      console.log('✅ Neon connected, schema ready.')
    } catch (e) {
      console.error('❌ Could not reach Neon. Check DATABASE_URL.\n  ', e.message)
    }
  }

  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`)
    if (isProd) console.log(`Serving the built client from ./dist on the same origin.`)
  })
}

start()
