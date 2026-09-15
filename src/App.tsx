import { AuthGate } from './components/AuthGate'
import { QuoteWorkspace } from './components/QuoteWorkspace'
import { supabase } from './lib/supabase'

function App() {
  return (
    <AuthGate>
      {(session) => (
        <div className="app-shell">
          <QuoteWorkspace userEmail={session.user.email || ''} userId={session.user.id} onSignOut={() => { void supabase.auth.signOut() }} />
        </div>
      )}
    </AuthGate>
  )
}

export default App
