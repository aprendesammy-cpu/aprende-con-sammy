import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import type { AuthContextValue } from '@/hooks/useAuth'
import type { AuthUser, User } from '@/types'

const { authState, listUsersMock } = vi.hoisted(() => ({
  authState: { current: {} as Partial<AuthContextValue> },
  listUsersMock: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
    hasRole: (role: string) => authState.current.role === role,
    ...authState.current,
  }),
  useOptionalAuth: () => authState.current,
  useAuthState: () => authState.current,
}))

// AdminUsers carga la lista al montarse: se aísla la capa de datos.
vi.mock('@/lib/users', () => ({
  listUsers: listUsersMock,
  createUserManually: vi.fn(),
  updateUserRole: vi.fn(),
  deleteUser: vi.fn(),
}))

const NOW = '2026-10-11T00:00:00.000Z'

/**
 * Construye un perfil de `public.users`.
 *
 * @param role Rol del perfil.
 */
function buildProfile(role: User['role'], email = 'ana@sammy.cl'): User {
  return {
    id: 'usuario-1',
    email,
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
 * Fija el estado de autenticación simulado.
 *
 * @param overrides Campos del contexto.
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

/** Sesión activa con el rol indicado. */
function signInAs(role: User['role']) {
  setAuth({
    user: buildAuthUser(),
    profile: buildProfile(role),
    isAuthenticated: true,
    role,
  })
}

/**
 * Monta el árbol de rutas en una dirección concreta.
 *
 * @param path URL inicial.
 */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/**
 * Comprueba que se renderizó el panel del usuario autenticado.
 *
 * Dos detalles que hacen fracasar una consulta ingenua:
 *  - Hay dos `<h1>` en pantalla (el del `Layout` y el de la página).
 *  - `findAllByRole` se resuelve en cuanto existe UNA coincidencia, y el `<h1>`
 *    del `Layout` aparece antes de que la página perezosa salga del `Suspense`.
 *
 * Con `findByRole` filtrando por nombre accesible, la consulta espera de verdad
 * al elemento correcto.
 *
 * @param name Nombre que muestra el saludo (`getDisplayName` usa el de pila).
 */
async function expectDashboardShown(name = 'Ana') {
  expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument()
}

describe('Enrutamiento — rutas públicas', () => {
  beforeEach(() => {
    listUsersMock.mockResolvedValue({ success: true, message: 'ok', data: [] })
    setAuth({ user: null, profile: null, isAuthenticated: false })
  })

  it('/login muestra el formulario de acceso', async () => {
    renderAt('/login')
    expect(await screen.findByText('Bienvenido de nuevo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument()
  })

  it('/register muestra el formulario de alta', async () => {
    renderAt('/register')
    expect(await screen.findByText('Crea tu cuenta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeInTheDocument()
  })

  it('una ruta desconocida muestra el 404', async () => {
    renderAt('/esta-ruta-no-existe')
    expect(await screen.findByText('404')).toBeInTheDocument()
    expect(screen.getByText('Esta página se fue de recreo')).toBeInTheDocument()
  })

  it('con sesión activa, /login redirige al panel', async () => {
    signInAs('padre')
    renderAt('/login')

    await expectDashboardShown()
    expect(screen.queryByText('Bienvenido de nuevo')).not.toBeInTheDocument()
  })
})

describe('Enrutamiento — rutas protegidas', () => {
  beforeEach(() => {
    listUsersMock.mockResolvedValue({ success: true, message: 'ok', data: [] })
  })

  it('sin sesión, una sección privada redirige al login', async () => {
    setAuth({ user: null, profile: null, isAuthenticated: false })
    renderAt('/progreso')

    expect(await screen.findByText('Bienvenido de nuevo')).toBeInTheDocument()
    expect(screen.queryByText('Progreso')).not.toBeInTheDocument()
  })

  it('mientras se resuelve la sesión muestra el indicador', () => {
    setAuth({ loading: true })
    renderAt('/progreso')

    expect(screen.getByText('Verificando tu sesión…')).toBeInTheDocument()
  })

  it('un padre autenticado entra en su panel', async () => {
    signInAs('padre')
    renderAt('/')

    await expectDashboardShown()

    // La etiqueta de rol aparece tres veces (lateral, cabecera y tarjeta del
    // panel): se acota al contenido principal para afirmar sobre la buena.
    const main = screen.getByRole('main')
    expect(within(main).getByText('Padre / Madre')).toBeInTheDocument()

    // El acceso de administración no se renderiza para un padre.
    expect(screen.queryByText('Gestión de Usuarios')).not.toBeInTheDocument()
  })

  it('la navegación inferior muestra las cinco secciones', async () => {
    signInAs('padre')
    renderAt('/')
    await expectDashboardShown()

    const nav = screen.getByRole('navigation', { name: 'Navegación inferior' })
    for (const label of ['Inicio', 'Cámara', 'Progreso', 'Recursos', 'Familia']) {
      expect(nav).toHaveTextContent(label)
    }
    // Un padre no ve el enlace de administración.
    expect(nav).not.toHaveTextContent('Usuarios')
  })

  it('cada sección protegida renderiza su página', async () => {
    signInAs('padre')

    const { unmount } = renderAt('/camara')
    expect(await screen.findByText('Cámara en vivo')).toBeInTheDocument()
    unmount()

    const second = renderAt('/progreso')
    expect(await second.findByText('Competencias')).toBeInTheDocument()
    second.unmount()

    const third = renderAt('/recursos')
    expect(await third.findByText('Academia para Padres')).toBeInTheDocument()
    third.unmount()

    const fourth = renderAt('/familia')
    expect(await fourth.findByText('Mi cuenta')).toBeInTheDocument()
    expect(fourth.getByText('ana@sammy.cl')).toBeInTheDocument()
    fourth.unmount()
  })
})

describe('Enrutamiento — control por rol', () => {
  beforeEach(() => {
    listUsersMock.mockResolvedValue({ success: true, message: 'ok', data: [] })
  })

  it('un admin ve el enlace y entra en Gestión de Usuarios', async () => {
    signInAs('admin')
    renderAt('/admin/usuarios')

    expect(await screen.findByText('Gestión de Usuarios')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear usuario manualmente/i })).toBeInTheDocument()
  })

  it('un padre que fuerza la URL de admin es redirigido con un aviso', async () => {
    signInAs('padre')
    renderAt('/admin/usuarios')

    // Aterriza en su panel, no en el de administración.
    await expectDashboardShown()
    expect(screen.queryByRole('button', { name: /crear usuario manualmente/i })).not.toBeInTheDocument()
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument()
    expect(screen.getByText(/solo para Administrador/i)).toBeInTheDocument()
  })

  it('un educador tampoco entra en administración', async () => {
    signInAs('educador')
    renderAt('/admin/usuarios')

    await expectDashboardShown()
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument()
  })
})

describe('Enrutamiento — navegación real entre secciones', () => {
  beforeEach(() => {
    listUsersMock.mockResolvedValue({ success: true, message: 'ok', data: [] })
  })

  it('un clic en la navegación inferior cambia de sección', async () => {
    const user = userEvent.setup()
    signInAs('padre')
    renderAt('/')

    await expectDashboardShown()
    const bottomNav = screen.getByRole('navigation', { name: 'Navegación inferior' })
    await user.click(within(bottomNav).getByRole('link', { name: /recursos/i }))

    expect(await screen.findByText('Academia para Padres')).toBeInTheDocument()
  })

  it('un admin navega desde el panel a Gestión de Usuarios', async () => {
    const user = userEvent.setup()
    signInAs('admin')
    renderAt('/')

    await expectDashboardShown()
    await user.click(screen.getByRole('link', { name: /gestión de usuarios/i }))

    expect(await screen.findByText('Crear Usuario Manualmente')).toBeInTheDocument()
  })
})
