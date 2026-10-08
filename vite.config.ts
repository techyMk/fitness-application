import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    host: true,
    // Same-origin in dev too: the refresh cookie is SameSite=Lax and the API
    // client uses credentials:'same-origin', so talking to :3001 directly from
    // :5180 would drop the cookie. Proxying keeps dev and production identical.
    proxy: {
      '/api': {
        target: process.env.API_ORIGIN || 'http://localhost:3001',
        changeOrigin: false,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          seed: ['./src/data/foods.ts', './src/data/exercises.ts'],
        },
      },
    },
  },
})
