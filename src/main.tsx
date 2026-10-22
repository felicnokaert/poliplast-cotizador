import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './glass.css'
import './crm-theme.css'
import './polish.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
