import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'

import { Layout } from '@/components/Layout'
import { ProtectedRoute, PublicOnlyRoute } from '@/components/ProtectedRoute'
import { FullPageLoader } from '@/components/ui/Spinner'

/**
 * ============================================================
 *  ENRUTAMIENTO — Aprende con Sammy
 * ============================================================
 *  Cada página se carga con `React.lazy`, de modo que el navegador solo
 *  descarga el código de la ruta que se visita. Sin esto, todo el panel de
 *  administración viajaba en el bundle inicial de un padre que nunca lo verá.
 *
 *  Estructura de guardas:
 *   - `/login` y `/register` → `PublicOnlyRoute` (redirige si ya hay sesión).
 *   - El resto               → `ProtectedRoute` envolviendo a `Layout`, así
 *                              una sola guarda cubre todas las secciones.
 *   - `/admin/usuarios`      → segunda guarda con `allowedRoles={['admin']}`.
 *
 *  La ocultación de rutas es UX, no seguridad: quien autoriza es Postgres
 *  mediante RLS (Paso 6).
 */

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const CameraPage = lazy(() => import('@/pages/CameraPage'))
const ProgressPage = lazy(() => import('@/pages/ProgressPage'))
const ResourcesPage = lazy(() => import('@/pages/ResourcesPage'))
const FamilyPage = lazy(() => import('@/pages/FamilyPage'))
const AdminUsers = lazy(() => import('@/pages/AdminUsers'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function App() {
  return (
    <Suspense fallback={<FullPageLoader message="Cargando Aprende con Sammy…" />}>
      <Routes>
        {/* ── Rutas públicas ─────────────────────────────────────── */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />

        {/* ── Secciones autenticadas bajo el mismo layout ────────── */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/camara" element={<CameraPage />} />
          <Route path="/progreso" element={<ProgressPage />} />
          <Route path="/recursos" element={<ResourcesPage />} />
          <Route path="/familia" element={<FamilyPage />} />

          {/* Solo administradores */}
          <Route
            path="/admin/usuarios"
            element={
              <ProtectedRoute allowedRoles={['admin']} fallbackPath="/">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* ── Cualquier otra dirección ───────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

export default App
