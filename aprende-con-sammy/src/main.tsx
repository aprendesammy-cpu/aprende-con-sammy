import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/hooks/useAuth'
import '@/index.css'

/**
 * Punto de entrada de la aplicación.
 *
 * Orden de los proveedores (de fuera hacia dentro):
 *  1. `StrictMode`    — detecta efectos impuros en desarrollo.
 *  2. `BrowserRouter` — el contexto de rutas.
 *  3. `AuthProvider`  — necesita el router para redirigir tras el login.
 *
 * Invertir 2 y 3 rompería `useNavigate` dentro del provider.
 */

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('No se encontró el elemento #root. Revisa el archivo index.html.')
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
