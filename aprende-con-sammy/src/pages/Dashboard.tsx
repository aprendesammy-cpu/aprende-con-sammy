import { Link, useLocation } from 'react-router-dom'

import { IconArrowRight, IconBook, IconCamera, IconChart, IconFamily, IconSparkle } from '@/components/icons'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'
import { getDisplayName } from '@/lib/auth'
import { getGreeting, readRouteState } from '@/lib/navigation'
import { USER_ROLE_LABELS } from '@/types'
import type { UserRole } from '@/types'

/**
 * Panel principal (sección «Inicio» de la navegación inferior).
 *
 * Saludo personalizado con el nombre y el rol del usuario. Si el rol es
 * `admin`, se muestra el acceso a Gestión de Usuarios.
 */

/** Tonos de insignia por rol. */
const ROLE_TONES: Record<UserRole, 'primary' | 'creative' | 'navy'> = {
  padre: 'primary',
  educador: 'creative',
  admin: 'navy',
}

/** Accesos rápidos a las otras secciones (iconos redondeados en colores de marca). */
const SHORTCUTS = [
  {
    to: '/camara',
    label: 'Cámara en vivo',
    description: 'Observa la sesión del aula',
    icon: IconCamera,
    tone: 'bg-primary-50 text-primary-600', /* Confianza */
  },
  {
    to: '/progreso',
    label: 'Progreso',
    description: 'Competencias y logros',
    icon: IconChart,
    tone: 'bg-sun-50 text-sun-600', /* Alegría */
  },
  {
    to: '/recursos',
    label: 'Recursos',
    description: 'Actividades para casa',
    icon: IconBook,
    tone: 'bg-creative-50 text-creative-500', /* Creatividad */
  },
  {
    to: '/familia',
    label: 'Mi familia',
    description: 'Plan, pagos y documentos',
    icon: IconFamily,
    tone: 'bg-sky-50 text-sky-600', /* Claridad */
  },
] as const

function Dashboard() {
  const { profile, user, role } = useAuth()
  const location = useLocation()
  const { deniedMessage } = readRouteState(location.state)

  const displayName = getDisplayName(profile)
  const isAdmin = role === 'admin'
  const isEducator = role === 'educador'

  return (
    <div className="flex flex-col gap-6">
      {deniedMessage ? (
        <Alert tone="warning" title="Acceso restringido">
          {deniedMessage}
        </Alert>
      ) : null}

      {/* ── Saludo ─────────────────────────────────────────────── */}
      <Card tone="navy" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">{getGreeting()},</p>
            <h1 className="font-head mt-0.5 truncate text-2xl font-extrabold text-navy-700 sm:text-3xl">
              {displayName}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {role ? (
                <Badge tone={ROLE_TONES[role]}>{USER_ROLE_LABELS[role]}</Badge>
              ) : null}
              {isEducator && profile?.sala ? (
                <Badge tone="creative">{profile.sala}</Badge>
              ) : null}
              <Badge tone="neutral">{user?.email}</Badge>
            </div>

            {/* Frase decorativa de la marca (Caveat) */}
            <p className="font-script mt-3 text-xl leading-none text-creative-500">
              Aprende a tu manera. Avanza con Sammy.
            </p>
          </div>

          {isAdmin ? (
            <Link
              to="/admin/usuarios"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-bold text-white shadow-soft transition hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              <IconFamily size={18} />
              Gestión de Usuarios
              <IconArrowRight size={16} />
            </Link>
          ) : null}
        </div>
      </Card>

      {/* ── Estado del día ─────────────────────────────────────── */}
      <Card
        title="Hoy en la sala"
        subtitle="Estado en tiempo real de la sesión"
        icon={<IconSparkle size={20} />}
        action={<Badge tone="neutral">Sin datos</Badge>}
      >
        <EmptyState
          variant="sitting"
          title="Aún no hay sesiones registradas"
          description={
            <>
              Aquí verás si tu hijo está <strong>en sesión</strong>, <strong>en recreo</strong>{' '}
              o <strong>en actividades</strong>, junto con las materias del día.
              <br />
              <span className="mt-2 block text-xs">
                Disponible cuando se creen las tablas <code>children</code>,{' '}
                <code>sessions</code> y <code>subjects</code> en el Paso 6.
              </span>
            </>
          }
        />
      </Card>

      {/* ── Accesos rápidos ────────────────────────────────────── */}
      <section>
        <h2 className="font-head mb-3 text-sm font-extrabold tracking-wide text-navy-700 uppercase">
          Secciones
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {SHORTCUTS.map((item) => {
            const ItemIcon = item.icon
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex h-full min-h-28 flex-col gap-2 rounded-card border-2 border-primary-100 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 motion-reduce:hover:translate-y-0"
                >
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-xl ${item.tone}`}
                    aria-hidden="true"
                  >
                    <ItemIcon size={20} />
                  </span>
                  <span className="font-head text-sm font-extrabold text-navy-700">{item.label}</span>
                  <span className="text-xs leading-snug text-muted">{item.description}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Detalle decorativo de marca (Caveat) */}
        <p className="font-script mt-4 text-center text-xl text-primary-600">
          La práctica hace grandes avances. ✦ ¡Tú puedes!
        </p>
      </section>
    </div>
  )
}

export default Dashboard
