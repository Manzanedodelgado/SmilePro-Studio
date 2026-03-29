import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupCentinela } from './centinela/engine'

// ── Instalar Centinela antes del render (captura errores globales) ──
setupCentinela();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

