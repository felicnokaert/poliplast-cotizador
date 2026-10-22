/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// `npm run maqueta`: el cotizador con datos de ejemplo y sin login, para trabajar el diseño en una
// compu sin usuario. Solo en modo "maqueta" (dev): el build de producción usa la base real.
const fakeSupabase = fileURLToPath(new URL('./src/dev/fakeSupabase.ts', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'maqueta' && {
      name: 'maqueta-supabase',
      enforce: 'pre' as const,
      resolveId(source: string, importer?: string) {
        if (importer && !importer.includes('fakeSupabase') && /(^|\/)supabase$/.test(source) && source.startsWith('.')) return fakeSupabase
        return null
      },
    },
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    // Valores de relleno: las pruebas no hablan con Supabase, pero src/lib/supabase.ts exige estas variables al cargarse.
    env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
  },
}))
