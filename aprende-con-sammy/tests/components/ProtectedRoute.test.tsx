import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from '@/components/ProtectedRoute'
import type { AuthContextValue } from '@/hooks/useAuth'
import type { AuthUser, User } from '@/types'

const { authState, refreshProfileMock } = vi.hoisted(() => ({
  authState: { current: {} as Partial<AuthContextValue> },
  refreshProfileMock: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    refreshProfile: refreshProfileMock,
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: (role: string) => authState.current.role === role,
    ...authState.current,
  }),
  useOptionalAuth: () => null,
  useAuthState: () => authState.current,
}))

const NOW = '2026-10-11T00:00:00.000Z'

/**
 * Construye un perfil de `public.users`.
 *
 * @param role Rol del perfil.
 */
function buildProfile(role: User['role']): User {
  return {
    id: 'usuario-1',
    email: 'ana@sammy.cl',
    name: 'Ana',
    full_name: 'Ana María Torres',
    role,
    sala: role === 'educador' ? 'Sala Arcoíris' : null,
    created_at: NOW,
    updated_at: NOW,
  }
}

/**
 * Construye un usuario de sesión mínimo.
 *
 * @param email Email del usuario.
 */
function buildAuthUser(email = 'ana@sammy.cl'): AuthUser {
  return { id: 'usuario-1', email, aud: 'authenticated', role: 'authenticated' } as AuthUser
}

/**
 * Fija el estado de autenticación para la prueba.
 *
 * @param overrides Campos del contexto a sobrescribir.
 */
function setAuth(overrides: Partial<AuthContextValue>) {
  authState.current = {
    user: null,
    profile: null,
    loading: false,
    isAuthenticated: false,
    role: null,
    configError: null,
    profileError: null,
    ...overrides,
  }
}

/**
 * Monta el árbol de rutas con las tres pantallas observables.
 *
 * @param element Contenido protegido a montar en la ruta inicial.
 * @param path Ruta protegida.
 */
function renderRoutes(element: React.ReactNode, path = '/privada') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>PANTALLA DE LOGIN</div>} />
        <Route path="/" element={<div>PANEL PRINCIPAL</div>} />
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute — estados previos a la autorización', () => {
  beforeEach(() => {
    refreshProfileMock.mockResolvedValue(true)
  })

  it('muestra un indicador mientras se resuelve la sesión', () => {
    setAuth({ loading: true })
    renderRoutes(
      <ProtectedRoute>
        <div>CONTENIDO PRIVADO</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Verificando tu sesión…')).toBeInTheDocument()
    expect(screen.queryByText('CONTENIDO PRIVADO')).not.toBeInTheDocument()
  })

  it('muestra las instrucciones de despliegue si falta configuración', () => {
    setAuth({ configError: 'Faltan variables de entorno obligatorias.' })
    renderRoutes(
      <ProtectedRoute>
        <div>CONTENIDO PRIVADO</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Configuración pendiente')).toBeInTheDocument()
    expect(screen.getByText(/\.env\.local/)).toBeInTheDocument()
    expect(screen.queryByText('CONTENIDO PRIVADO')).not.toBeInTheDocument()
  })

  it('redirige al login conservando el destino original', () => {
    setAuth({ user: null, isAuthenticated: false })
    renderRoutes(
      <ProtectedRoute>
        <div>CONTENIDO PRIVADO</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('PANTALLA DE LOGIN')).toBeInTheDocument()
    expect(screen.queryByText('CONTENIDO PRIVADO')).not.toBeInTheDocument()
  })
})

describe('ProtectedRoute — perfil no disponible', () => {
  beforeEach(() => {
    refreshProfileMock.mockResolvedValue(true)
  })

  it('ofrece reintentar SIN cerrar la sesión ante un fallo de red', () => {
    setAuth({
      user: buildAuthUser(),
      profile: null,
      isAuthenticated: false,
      profileError: 'No pudimos cargar tu perfil.',
    })

    renderRoutes(
      <ProtectedRoute>
        <div>CONTENIDO PRIVADO</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('No pudimos cargar tu perfil')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    // No se expulsa al usuario: sigue sin redirigir al login.
    expect(screen.queryByText('PANTALLA DE LOGIN')).not.toBeInTheDocument()
  })

  it('el botón de reintento invoca refreshProfile', async () => {
    const user = userEvent.setup()
    setAuth({
      user: buildAuthUser(),
      profile: null,
      isAuthenticated: false,
      profileError: 'No pudimos cargar tu perfil.',
    })

    renderRoutes(
      <ProtectedRoute>
        <div>CONTENIDO PRIVADO</div>
      </ProtectedRoute>,
    )

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(refreshProfileMock).toHaveBeenCalled()
  })

  it('bloquea el acceso si hay sesión pero falta la fila en users', () => {
    setAuth({
      user: buildAuthUser(),
      profile: null,
      isAuthenticated: false,
      profileError: null,
    })

    renderRoutes(
      <ProtectedRoute>
        <div>CONTENIDO PRIVADO</div>
      </ProtectedRoute>,
    )

    expect(screen.queryByText('CONTENIDO PRIVADO')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})

describe('ProtectedRoute — control por rol', () => {
  beforeEach(() => {
    refreshProfileMock.mockResolvedValue(true)
  })

  it('deja pasar a un usuario autenticado sin restricción de rol', () => {
    setAuth({
      user: buildAuthUser(),
      profile: buildProfile('padre'),
      isAuthenticated: true,
      role: 'padre',
    })

    renderRoutes(
      <ProtectedRoute>
        <div>CONTENIDO PRIVADO</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('CONTENIDO PRIVADO')).toBeInTheDocument()
  })

  it('redirige al panel principal si el rol no está permitido', () => {
    setAuth({
      user: buildAuthUser(),
      profile: buildProfile('padre'),
      isAuthenticated: true,
      role: 'padre',
    })

    renderRoutes(
      <ProtectedRoute allowedRoles={['admin']}>
        <div>PANEL DE ADMINISTRACIÓN</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('PANEL PRINCIPAL')).toBeInTheDocument()
    expect(screen.queryByText('PANEL DE ADMINISTRACIÓN')).not.toBeInTheDocument()
  })

  it('permite el acceso al rol autorizado', () => {
    setAuth({
      user: buildAuthUser(),
      profile: buildProfile('admin'),
      isAuthenticated: true,
      role: 'admin',
    })

    renderRoutes(
      <ProtectedRoute allowedRoles={['admin']}>
        <div>PANEL DE ADMINISTRACIÓN</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('PANEL DE ADMINISTRACIÓN')).toBeInTheDocument()
  })

  it('RoleRoute es azúcar sintáctica de un solo rol', () => {
    setAuth({
      user: buildAuthUser(),
      profile: buildProfile('educador'),
      isAuthenticated: true,
      role: 'educador',
    })

    renderRoutes(
      <RoleRoute role="admin">
        <div>PANEL DE ADMINISTRACIÓN</div>
      </RoleRoute>,
    )

    expect(screen.getByText('PANEL PRINCIPAL')).toBeInTheDocument()
  })
})

describe('PublicOnlyRoute', () => {
  beforeEach(() => {
    refreshProfileMock.mockResolvedValue(true)
  })

  it('deja pasar a quien no tiene sesión', () => {
    setAuth({ user: null, profile: null, isAuthenticated: false })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <div>FORMULARIO DE ACCESO</div>
              </PublicOnlyRoute>
            }
          />
          <Route path="/" element={<div>PANEL PRINCIPAL</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('FORMULARIO DE ACCESO')).toBeInTheDocument()
  })

  it('redirige al panel si la sesión ya está activa', () => {
    setAuth({
      user: buildAuthUser(),
      profile: buildProfile('padre'),
      isAuthenticated: true,
      role: 'padre',
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <div>FORMULARIO DE ACCESO</div>
              </PublicOnlyRoute>
            }
          />
          <Route path="/" element={<div>PANEL PRINCIPAL</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('PANEL PRINCIPAL')).toBeInTheDocument()
    expect(screen.queryByText('FORMULARIO DE ACCESO')).not.toBeInTheDocument()
  })
})
