import { AuthGate } from './components/AuthGate'
import { QuoteWorkspace } from './components/QuoteWorkspace'
import { supabase } from './lib/supabase'

function App() {
  return (
    <AuthGate>
      {(session) => (
        <div className="app-shell">
          <div className="topbar">
            <span className="muted">{session.user.email}</span>
            <button className="link-button" onClick={() => supabase.auth.signOut()}>
              Salir
            </button>
          </div>
          <QuoteWorkspace userEmail={session.user.email || ''} />
        </div>
      )}
    </AuthGate>
  )
}

export default App
