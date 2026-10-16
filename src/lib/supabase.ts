import { createClient } from '@supabase/supabase-js'
import { isEmbeddedInCrm } from './embed'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el entorno.')
}

// Dentro del CRM la sesión la maneja el CRM (ver embed.ts): acá ni se guarda ni se renueva.
const embedded = typeof window !== 'undefined' && isEmbeddedInCrm()
export const supabase = createClient(url, anonKey, embedded ? { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } : undefined)
