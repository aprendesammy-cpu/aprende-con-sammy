import { useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { USER_ROLE_LABELS } from '@/types'
import type { User, UserRole } from '@/types'

/**
 * Tabla de usuarios del panel de administración.
 *
 * En móvil cada fila se convierte en tarjeta: una tabla de seis columnas no
 * cabe en 360 px sin scroll horizontal, y el scroll horizontal en listas es
 * un patrón que oculta las acciones.
 */

/** Tonos de insignia por rol. */
const ROLE_TONES: Record<UserRole, 'primary' | 'creative' | 'navy'> = {
  padre: 'primary',
  educador: 'creative',
  admin: 'navy',
}

const ROLE_OPTIONS = (['padre', 'educador', 'admin'] as UserRole[]).map((role) => ({
  value: role,
  label: USER_ROLE_LABELS[role],
}))

/** Props de la tabla. */
export interface UsersTableProps {
  users: User[]
  /** Identificador del usuario cuya fila está procesando una acción. */
  busyId?: string | null
  onRoleChange: (userId: string, role: UserRole) => void
  onDelete: (userId: string) => void
}

/**
 * Formatea una fecha ISO a formato legible en español.
 *
 * @param iso Fecha en formato ISO 8601.
 */
function formatDate(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/**
 * Lista de usuarios con edición de rol y borrado.
 *
 * @param props Usuarios y callbacks.
 */
export function UsersTable({ users, busyId, onRoleChange, onDelete }: UsersTableProps) {
  /** Identificador pendiente de confirmar el borrado. */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      {/* ── Vista de tarjetas (móvil) ───────────────────────────── */}
      <ul className="flex flex-col gap-3 md:hidden">
        {users.map((user) => {
          const isBusy = busyId === user.id
          return (
            <li
              key={user.id}
              className="rounded-card border border-slate-100 bg-white p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-navy-700">
                    {user.full_name ?? user.name ?? 'Sin nombre'}
                  </p>
                  <p className="truncate text-xs text-muted">{user.email}</p>
                </div>
                <Badge tone={ROLE_TONES[user.role]}>{USER_ROLE_LABELS[user.role]}</Badge>
              </div>

              {user.sala ? (
                <p className="mt-2 text-xs text-muted">
                  <span className="font-bold">Sala:</span> {user.sala}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted">Alta: {formatDate(user.created_at)}</p>

              <RowActions
                userId={user.id}
                isBusy={isBusy}
                pending={pendingDeleteId === user.id}
                onAskDelete={() => setPendingDeleteId(user.id)}
                onCancelDelete={() => setPendingDeleteId(null)}
                onDelete={onDelete}
              />
            </li>
          )
        })}
      </ul>

      {/* ── Vista de tabla (escritorio) ─────────────────────────── */}
      <div className="hidden overflow-hidden rounded-card border border-slate-100 bg-white shadow-soft md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Usuarios registrados, con su rol, sala y fecha de alta
          </caption>
          <thead>
            <tr className="border-b border-slate-100 bg-cream text-xs tracking-wide text-muted uppercase">
              <th scope="col" className="px-4 py-3 font-extrabold">
                Nombre
              </th>
              <th scope="col" className="px-4 py-3 font-extrabold">
                Email
              </th>
              <th scope="col" className="px-4 py-3 font-extrabold">
                Rol
              </th>
              <th scope="col" className="px-4 py-3 font-extrabold">
                Sala
              </th>
              <th scope="col" className="px-4 py-3 font-extrabold">
                Alta
              </th>
              <th scope="col" className="px-4 py-3 text-right font-extrabold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isBusy = busyId === user.id
              return (
                <tr
                  key={user.id}
                  className="border-b border-slate-50 transition-colors last:border-0 hover:bg-cream/60"
                >
                  <th scope="row" className="px-4 py-3 font-bold text-navy-700">
                    <span className="block max-w-52 truncate">
                      {user.full_name ?? user.name ?? 'Sin nombre'}
                    </span>
                  </th>
                  <td className="px-4 py-3 text-muted">
                    <span className="block max-w-56 truncate">{user.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONES[user.role]}>{USER_ROLE_LABELS[user.role]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{user.sala ?? '—'}</td>
                  <td className="px-4 py-3 text-muted tabular-nums">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <label className="sr-only" htmlFor={`rol-${user.id}`}>
                        Cambiar el rol de {user.full_name ?? user.email}
                      </label>
                      <Select
                        id={`rol-${user.id}`}
                        label=""
                        fullWidth={false}
                        placeholder={null}
                        options={ROLE_OPTIONS}
                        value={user.role}
                        disabled={isBusy}
                        aria-label={`Rol de ${user.full_name ?? user.email}`}
                        className="min-w-36 py-1.5 text-xs"
                        onChange={(event) =>
                          onRoleChange(user.id, event.target.value as UserRole)
                        }
                      />
                      <RowActions
                        userId={user.id}
                        isBusy={isBusy}
                        pending={pendingDeleteId === user.id}
                        onAskDelete={() => setPendingDeleteId(user.id)}
                        onCancelDelete={() => setPendingDeleteId(null)}
                        onDelete={onDelete}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Props de las acciones de una fila. */
interface RowActionsProps {
  userId: string
  isBusy: boolean
  pending: boolean
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: (userId: string) => void
}

/**
 * Botón de borrado con confirmación en línea.
 *
 * Se evita `window.confirm`: bloquea el hilo, no se puede estilizar y en
 * algunos navegadores móviles ni aparece.
 *
 * @param props Estado de la fila y callbacks.
 */
function RowActions({
  userId,
  isBusy,
  pending,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: RowActionsProps) {
  if (!pending) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onAskDelete}
        disabled={isBusy}
        className="text-danger-500 hover:bg-danger-50"
        aria-label="Eliminar usuario"
      >
        Eliminar
      </Button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5" role="group" aria-label="Confirmar borrado">
      <span className="text-xs font-bold text-muted">¿Seguro?</span>
      <Button
        type="button"
        variant="danger"
        size="sm"
        loading={isBusy}
        onClick={() => onDelete(userId)}
      >
        Sí
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancelDelete} disabled={isBusy}>
        No
      </Button>
    </span>
  )
}
