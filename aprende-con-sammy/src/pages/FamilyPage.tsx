import { IconFamily, IconMail, IconUser } from '@/components/icons'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { USER_ROLE_LABELS } from '@/types'
import type { UserRole } from '@/types'

/**
 * Perfil de familia.
 *
 * Los datos de la cuenta se leen de `public.users`, así que esta pantalla ya
 * muestra información real. La sección de hijos, plan y pagos queda en estado
 * vacío hasta que existan las tablas `children`, `payments` y `documents`.
 */

const ROLE_TONES: Record<UserRole, 'primary' | 'creative' | 'navy'> = {
  padre: 'primary',
  educador: 'creative',
  admin: 'navy',
}

/**
 * Formatea una fecha ISO en español.
 *
 * @param iso Fecha ISO 8601.
 */
function formatLongDate(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function FamilyPage() {
  const { profile, user, role, logout } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold text-navy-700 sm:text-3xl">Mi familia</h1>
        <p className="mt-1 text-sm text-muted">Cuenta, plan, sesiones y documentos.</p>
      </header>

      {/* ── Datos reales de la cuenta ──────────────────────────── */}
      <Card title="Mi cuenta" icon={<IconUser size={20} />}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold tracking-wide text-muted uppercase">
              Nombre completo
            </dt>
            <dd className="mt-1 text-sm font-bold text-navy-700">
              {profile?.full_name ?? profile?.name ?? '—'}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-bold tracking-wide text-muted uppercase">
              Correo electrónico
            </dt>
            <dd className="mt-1 flex items-center gap-1.5 text-sm font-bold text-navy-700">
              <IconMail size={15} />
              <span className="truncate">{profile?.email ?? user?.email ?? '—'}</span>
            </dd>
          </div>

          <div>
            <dt className="text-xs font-bold tracking-wide text-muted uppercase">Rol</dt>
            <dd className="mt-1">
              {role ? (
                <Badge tone={ROLE_TONES[role]}>{USER_ROLE_LABELS[role]}</Badge>
              ) : (
                <span className="text-sm text-muted">—</span>
              )}
            </dd>
          </div>

          {profile?.sala ? (
            <div>
              <dt className="text-xs font-bold tracking-wide text-muted uppercase">
                Sala que lideras
              </dt>
              <dd className="mt-1 text-sm font-bold text-navy-700">{profile.sala}</dd>
            </div>
          ) : null}

          <div>
            <dt className="text-xs font-bold tracking-wide text-muted uppercase">
              Miembro desde
            </dt>
            <dd className="mt-1 text-sm font-bold text-navy-700">
              {formatLongDate(profile?.created_at ?? '')}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-bold tracking-wide text-muted uppercase">
              Identificador
            </dt>
            <dd className="mt-1 truncate font-mono text-xs text-muted">
              {profile?.id ?? user?.id ?? '—'}
            </dd>
          </div>
        </dl>
      </Card>

      {/* ── Secciones pendientes de la Fase B ──────────────────── */}
      <Card title="Mis hijos" subtitle="Información, plan y calendario de sesiones">
        <EmptyState
          variant="sitting"
          title="Todavía no hay niños vinculados"
          description={
            <>
              Aquí verás la ficha de cada niño, el plan contratado, el estado de pagos, el
              calendario de sesiones y los documentos descargables.
              <br />
              <span className="mt-2 block text-xs">
                Depende de las tablas <code>children</code>, <code>payments</code> y{' '}
                <code>documents</code>. La vinculación la realiza el centro educativo.
              </span>
            </>
          }
        />
      </Card>

      <Card title="Sesión" icon={<IconFamily size={20} />}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
          <p className="self-center text-xs text-muted">
            Tu sesión se guarda en este navegador y caduca automáticamente.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default FamilyPage
