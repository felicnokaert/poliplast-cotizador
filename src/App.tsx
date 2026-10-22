import { AuthGate } from './components/AuthGate'
import { QuoteWorkspace } from './components/QuoteWorkspace'
import { supabase } from './lib/supabase'
import { isEmbeddedInCrm } from './lib/embed'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  return (
    <AuthGate>
      {(session) => (
        <div className="app-shell">
          <ErrorBoundary><QuoteWorkspace userEmail={session.user.email || ''} userId={session.user.id} onSignOut={isEmbeddedInCrm() ? undefined : () => { void supabase.auth.signOut() }} /></ErrorBoundary>
        </div>
      )}
    </AuthGate>
  )
}

export default App
