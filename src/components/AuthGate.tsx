import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { CRM_ORIGINS, isCrmOrigin, isEmbeddedInCrm } from '../lib/embed'

export function AuthGate({ children }: { children: (session: Session) => React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Pestaña del CRM: avisa que está lista y espera la sesión del CRM (y sus renovaciones). Si no llega
  // en unos segundos, muestra el login de siempre.
  useEffect(() => {
    if (!isEmbeddedInCrm()) return undefined
    document.documentElement.classList.add('cot-embedded')
    const onMessage = (event: MessageEvent) => {
      if (!isCrmOrigin(event.origin) || event.source !== window.parent) return
      const data = event.data as { tipo?: string; access_token?: string; refresh_token?: string }
      if (data?.tipo !== 'crm:sesion' || !data.access_token || !data.refresh_token) return
      void supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token }).then(({ data: result }) => {
        setSession(result.session)
        setLoading(false)
      })
    }
    window.addEventListener('message', onMessage)
    for (const origin of CRM_ORIGINS) window.parent.postMessage({ tipo: 'cotizador:listo' }, origin)
    const fallback = window.setTimeout(() => setLoading(false), 5000)
    return () => { window.removeEventListener('message', onMessage); window.clearTimeout(fallback) }
  }, [])

  useEffect(() => {
    if (isEmbeddedInCrm()) return undefined
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) setError(error.message)
  }

  if (loading) {
    return <div className="centered-page">Cargando...</div>
  }

  if (!session) {
    return (
      <div className="centered-page">
        <form className="login-card" onSubmit={handleSubmit}>
          <h1>Cotizador Poliplast</h1>
          <p className="muted">Ingresá con tu cuenta del equipo (misma cuenta que el CRM).</p>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    )
  }

  return <>{children(session)}</>
}
