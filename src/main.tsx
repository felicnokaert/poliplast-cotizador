import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './glass.css'
import './crm-theme.css'
import './polish.css'
import './dark-theme.css'
import App from './App.tsx'
import { seguirTemaDelCrm } from './lib/tema'

seguirTemaDelCrm()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
