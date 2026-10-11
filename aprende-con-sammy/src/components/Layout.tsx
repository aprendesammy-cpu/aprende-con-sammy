import { Suspense, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import {
  IconBook,
  IconCamera,
  IconChart,
  IconFamily,
  IconHome,
  IconLogout,
} from '@/components/icons'
import { SammyMark } from '@/components/SammyMascot'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { useOptionalAuth } from '@/hooks/useAuth'
import { USER_ROLE_LABELS } from '@/types'
import type { UserRole } from '@/types'

/**
 * ============================================================
 *  Estructura de la aplicación
 * ============================================================
 *  Mobile-first: barra superior + navegación inferior de 5 secciones con
 *  soporte de `safe-area-inset-bottom` para iPhone con notch.
 *  En escritorio (>= md) la navegación inferior se convierte en lateral.
 *
 *  Funciona con `children` (uso directo) o con `<Outlet />` (layout de ruta),
 *  de modo que sirva tanto para el enrutador del Paso 5 como para vistas
 *  aisladas.
 */

/** Entrada de navegación. */
interface NavItem {
  to: string
  label: string
  icon: (props: { size?: number }) => ReactNode
  /** `end` evita que "/" quede activo en todas las rutas. */
  end?: boolean
  /** Visible solo para determinados roles. */
  roles?: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', icon: IconHome, end: true },
  { to: '/camara', label: 'Cámara', icon: IconCamera },
  { to: '/progreso', label: 'Progreso', icon: IconChart },
  { to: '/recursos', label: 'Recursos', icon: IconBook },
  { to: '/familia', label: 'Familia', icon: IconFamily },
  { to: '/admin/usuarios', label: 'Usuarios', icon: IconFamily, roles: ['admin'] },
]

/** Tonos de insignia por rol. */
const ROLE_TONES: Record<UserRole, 'navy' | 'primary' | 'creative'> = {
  padre: 'primary',
  educador: 'creative',
  admin: 'navy',
}

/** Props del layout. */
export interface LayoutProps {
  /** Contenido explícito. Si se omite, se renderiza el `<Outlet />` de la ruta. */
  children?: ReactNode
  /** Título de la vista, mostrado en la barra superior en móvil. */
  title?: string
}

/**
 * Envoltorio visual de la aplicación.
 *
 * @param props Contenido y título opcionales.
 */
export function Layout({ children, title }: LayoutProps) {
  const auth = useOptionalAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  const isAuthenticated = auth?.isAuthenticated ?? false
  const role = auth?.role ?? null
  const displayName =
    auth?.profile?.name ?? auth?.profile?.full_name ?? auth?.user?.email ?? null

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (role !== null && item.roles.includes(role)),
  )

  /**
   * Cierra la sesión y vuelve al inicio de sesión.
   */
  async function handleLogout(): Promise<void> {
    if (!auth || loggingOut) return
    setLoggingOut(true)
    try {
      await auth.logout()
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('[Layout] No se pudo cerrar la sesión:', error)
    } finally {
      setLoggingOut(false)
    }
  }

  /** Enlace de navegación reutilizable por la barra lateral y la inferior. */
  function renderNavItem(item: NavItem, orientation: 'horizontal' | 'vertical') {
    const Icon = item.icon
    const isVertical = orientation === 'vertical'

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          [
            'group relative flex items-center gap-3 font-bold transition-colors duration-150',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
            isVertical
              ? 'min-h-11 w-full rounded-xl px-3 py-2.5 text-sm'
              : 'min-tap min-w-0 flex-1 flex-col justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px]',
            isActive
              ? isVertical
                ? 'bg-primary-50 text-primary-700'
                : 'text-primary-600'
              : isVertical
                ? 'text-muted hover:bg-slate-100 hover:text-navy-700'
                : 'text-muted hover:text-navy-700',
          ].join(' ')
        }
      >
        {({ isActive }) => (
          <>
            <Icon size={isVertical ? 20 : 22} />
            <span className={isVertical ? 'truncate' : 'truncate text-center'}>
              {item.label}
            </span>
            {!isVertical && isActive ? (
              <span
                className="absolute inset-x-3 -bottom-0.5 h-1 rounded-full bg-primary-400"
                aria-hidden="true"
              />
            ) : null}
            {isVertical && isActive ? (
              <span
                className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary-400"
                aria-hidden="true"
              />
            ) : null}
          </>
        )}
      </NavLink>
    )
  }

  return (
    <div className="min-h-dvh bg-cream md:flex">
      {/* ── Barra lateral (escritorio) ─────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 md:flex">
        <div className="flex items-center gap-3 px-2">
          <SammyMark size={40} />
          <div className="min-w-0">
            <p className="truncate text-base leading-tight font-extrabold text-navy-700">
              Aprende con Sammy
            </p>
            <p className="truncate text-xs text-muted">Aprender juntos</p>
          </div>
        </div>

        {isAuthenticated ? (
          <nav aria-label="Navegación lateral" className="mt-7 flex flex-col gap-1">
            {visibleItems.map((item) => renderNavItem(item, 'vertical'))}
          </nav>
        ) : null}

        <div className="mt-auto pt-6">
          {isAuthenticated ? (
            <div className="rounded-card border border-slate-100 bg-cream p-3">
              <p className="truncate text-sm font-bold text-navy-700">{displayName}</p>
              {role ? (
                <Badge tone={ROLE_TONES[role]} className="mt-1.5">
                  {USER_ROLE_LABELS[role]}
                </Badge>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                loading={loggingOut}
                onClick={() => void handleLogout()}
                icon={<IconLogout size={16} />}
                className="mt-2.5"
              >
                Cerrar sesión
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="sm" fullWidth onClick={() => navigate('/login')}>
                Iniciar sesión
              </Button>
              <Button variant="outline" size="sm" fullWidth onClick={() => navigate('/register')}>
                Crear cuenta
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Columna principal ──────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
          <div
            className="flex items-center gap-3 px-4 py-3 md:px-8"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="md:hidden">
                <SammyMark size={34} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-base leading-tight font-extrabold text-navy-700 md:hidden">
                  {title ?? 'Aprende con Sammy'}
                </h1>
                <p className="hidden truncate text-sm text-muted md:block">
                  {title ?? 'Panel de la familia'}
                </p>
              </div>
            </div>

            {isAuthenticated ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-right sm:block">
                  <span className="block max-w-40 truncate text-sm font-bold text-navy-700">
                    {displayName}
                  </span>
                  {role ? (
                    <span className="block text-xs text-muted">{USER_ROLE_LABELS[role]}</span>
                  ) : null}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleLogout()}
                  loading={loggingOut}
                  aria-label="Cerrar sesión"
                  className="md:hidden"
                >
                  <IconLogout size={18} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleLogout()}
                  loading={loggingOut}
                  icon={<IconLogout size={16} />}
                  className="hidden md:inline-flex"
                >
                  Cerrar sesión
                </Button>
              </div>
            ) : null}
          </div>
        </header>

        <main
          id="contenido-principal"
          className="flex-1 px-4 pt-5 md:px-8 md:pt-8"
          style={{
            paddingBottom:
              'calc(var(--tabbar-height) + env(safe-area-inset-bottom) + 1rem)',
          }}
        >
          <div className="mx-auto w-full max-w-5xl">
            {/* Límite de Suspense propio: al cargar una ruta perezosa solo se
                sustituye el contenido, no la barra superior ni la navegación. */}
            <Suspense
              fallback={
                <div className="grid place-items-center py-20">
                  <Spinner size="lg" label="Cargando sección" />
                </div>
              }
            >
              {children ?? <Outlet />}
            </Suspense>
          </div>
        </main>

        {/* ── Navegación inferior (móvil) ────────────────────────── */}
        {isAuthenticated ? (
          <nav
            aria-label="Navegación inferior"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <ul
              className="mx-auto flex w-full max-w-lg items-stretch px-2"
              style={{ height: 'var(--tabbar-height)' }}
            >
              {visibleItems.map((item) => (
                <li key={item.to} className="flex min-w-0 flex-1">
                  {renderNavItem(item, 'horizontal')}
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  )
}
