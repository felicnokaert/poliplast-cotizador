import { AuthGate } from './components/AuthGate'
import { QuoteWorkspace } from './components/QuoteWorkspace'
import { supabase } from './lib/supabase'
import { isEmbeddedInCrm } from './lib/embed'

function App() {
  return (
    <AuthGate>
      {(session) => (
        <div className="app-shell">
          <QuoteWorkspace userEmail={session.user.email || ''} userId={session.user.id} onSignOut={isEmbeddedInCrm() ? undefined : () => { void supabase.auth.signOut() }} />
        </div>
      )}
    </AuthGate>
  )
}

export default App
