import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CreateUserDialog } from '@/components/CreateUserDialog'
import { IconRefresh, IconUser } from '@/components/icons'
import { UsersTable } from '@/components/UsersTable'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { deleteUser, listUsers, updateUserRole } from '@/lib/users'
import { normalizeEmail } from '@/lib/utils'
import { USER_ROLE_LABELS } from '@/types'
import type { DataResult, User, UserRole } from '@/types'

/**
 * Gestión de Usuarios — accesible solo con rol `admin`.
 *
 * La protección es de tres capas y las tres son necesarias:
 *  1. `<ProtectedRoute allowedRoles={['admin']}>` en el enrutador (UX).
 *  2. Políticas RLS en Postgres (autoridad real).
 *  3. La Edge Function vuelve a comprobar el rol del token (el alta).
 *
 * Ocultar la ruta NO es seguridad: cualquiera puede invocar la API desde la
 * consola. Quien autoriza es la base de datos.
 */

const ALL_ROLES: UserRole[] = ['padre', 'educador', 'admin']

function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{
    tone: 'success' | 'error'
    text: string
  } | null>(null)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  /** Identificador de la última petición de lista, para descartar las obsoletas. */
  const latestRequestId = useRef(0)

  /**
   * Aplica el resultado de una carga de la lista.
   *
   * `requestId` descarta respuestas obsoletas: sin él, pulsar «Actualizar» dos
   * veces seguidas podía pintar antes la respuesta lenta y pisar después la
   * rápida con datos viejos.
   *
   * @param requestId Identificador de la petición que produjo el resultado.
   * @param result Resultado devuelto por `listUsers`.
   */
  const applyUsersResult = useCallback((requestId: number, result: DataResult<User[]>): void => {
    if (requestId !== latestRequestId.current) {
      return
    }

    if (!result.success || !result.data) {
      setListError(result.message)
      setUsers([])
    } else {
      setUsers(result.data)
      setListError(null)
    }

    setLoading(false)
  }, [])

  /**
   * Carga inicial.
   *
   * La función asíncrona se define DENTRO del efecto y ningún `setState` ocurre
   * antes del primer `await`: llamar desde aquí a una función que sí lo hiciera
   * provocaría renders en cascada y desactivaría el React Compiler. La bandera
   * `active` evita escribir estado sobre un componente ya desmontado.
   */
  useEffect(() => {
    let active = true
    const requestId = ++latestRequestId.current

    async function load(): Promise<void> {
      const result = await listUsers()
      if (!active) {
        return
      }
      applyUsersResult(requestId, result)
    }

    void load()

    return () => {
      active = false
    }
  }, [applyUsersResult])

  /**
   * Recarga explícita desde el botón «Actualizar».
   *
   * Al invocarse desde un manejador de eventos, activar el spinner aquí sí es
   * legítimo (no ocurre dentro de un efecto).
   */
  const reload = useCallback(async (): Promise<void> => {
    const requestId = ++latestRequestId.current
    setLoading(true)

    const result = await listUsers()
    applyUsersResult(requestId, result)
  }, [applyUsersResult])

  /** Contadores por rol, para la cabecera. */
  const counts = useMemo(() => {
    const base: Record<UserRole, number> = { padre: 0, educador: 0, admin: 0 }
    for (const user of users) {
      base[user.role] += 1
    }
    return base
  }, [users])

  /** Lista filtrada por la búsqueda. */
  const filteredUsers = useMemo(() => {
    const needle = normalizeEmail(search)
    if (!needle) return users

    return users.filter((user) => {
      const haystack = `${user.email} ${user.full_name ?? ''} ${user.name ?? ''} ${user.sala ?? ''}`
        .toLowerCase()
        .trim()
      return haystack.includes(needle)
    })
  }, [users, search])

  /**
   * Cambia el rol de un usuario con actualización optimista.
   *
   * @param userId Identificador del usuario.
   * @param role Nuevo rol.
   */
  async function handleRoleChange(userId: string, role: UserRole): Promise<void> {
    const target = users.find((user) => user.id === userId)
    if (!target || target.role === role) return

    setBusyId(userId)
    setActionMessage(null)

    // Optimista: la tabla refleja el cambio de inmediato.
    const snapshot = users
    setUsers((previous) =>
      previous.map((user) =>
        user.id === userId
          ? { ...user, role, sala: role === 'educador' ? user.sala : null }
          : user,
      ),
    )

    const result = await updateUserRole(
      userId,
      role,
      role === 'educador' ? target.sala : null,
    )

    if (result.success && result.data) {
      setUsers((previous) =>
        previous.map((user) => (user.id === userId ? result.data! : user)),
      )
      setActionMessage({ tone: 'success', text: result.message })
    } else {
      // Se revierte: la base de datos es la autoridad.
      setUsers(snapshot)
      setActionMessage({ tone: 'error', text: result.message })
    }

    setBusyId(null)
  }

  /**
   * Elimina la fila de `public.users`.
   *
   * @param userId Identificador del usuario.
   */
  async function handleDelete(userId: string): Promise<void> {
    setBusyId(userId)
    setActionMessage(null)

    const result = await deleteUser(userId)

    if (result.success) {
      setUsers((previous) => previous.filter((user) => user.id !== userId))
      setActionMessage({ tone: 'success', text: result.message })
    } else {
      setActionMessage({ tone: 'error', text: result.message })
    }

    setBusyId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-700 sm:text-3xl">
            Gestión de Usuarios
          </h1>
          <p className="mt-1 text-sm text-muted">
            Altas, roles y bajas de la tabla <code className="font-mono text-xs">users</code>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => void reload()}
            loading={loading}
            icon={<IconRefresh size={16} />}
          >
            Actualizar
          </Button>
          <Button
            variant="primary"
            onClick={() => setDialogOpen(true)}
            icon={<IconUser size={16} />}
          >
            Crear Usuario Manualmente
          </Button>
        </div>
      </header>

      {/* ── Resumen por rol ────────────────────────────────────── */}
      <Card title="Resumen" subtitle={`${users.length} usuarios registrados`}>
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map((role) => (
            <Badge key={role} tone={role === 'admin' ? 'navy' : role === 'educador' ? 'creative' : 'primary'}>
              {USER_ROLE_LABELS[role]}: {counts[role]}
            </Badge>
          ))}
        </div>
      </Card>

      {actionMessage ? (
        <Alert
          tone={actionMessage.tone}
          onDismiss={() => setActionMessage(null)}
        >
          {actionMessage.text}
        </Alert>
      ) : null}

      {listError ? (
        <Alert
          tone="error"
          title="No se pudo cargar la lista"
          action={
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Reintentar
            </Button>
          }
        >
          {listError}
        </Alert>
      ) : null}

      {/* ── Listado ────────────────────────────────────────────── */}
      <Card flush>
        <div className="flex flex-col gap-4 p-5 pb-0">
          <Input
            label="Buscar"
            name="search"
            type="search"
            placeholder="Nombre, email o sala…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <p className="text-xs text-muted" aria-live="polite">
            {loading
              ? 'Cargando usuarios…'
              : `${filteredUsers.length} de ${users.length} usuarios`}
          </p>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="grid place-items-center py-14">
              <Spinner size="lg" label="Cargando usuarios" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              variant="sitting"
              title={users.length === 0 ? 'Todavía no hay usuarios' : 'Sin coincidencias'}
              description={
                users.length === 0
                  ? 'Crea el primero con el botón «Crear Usuario Manualmente», o espera a que las familias se registren.'
                  : `Ningún usuario coincide con «${search}». Prueba con otro término.`
              }
              actionLabel={users.length === 0 ? 'Crear el primer usuario' : undefined}
              onAction={users.length === 0 ? () => setDialogOpen(true) : undefined}
            />
          ) : (
            <UsersTable
              users={filteredUsers}
              busyId={busyId}
              onRoleChange={(userId, role) => void handleRoleChange(userId, role)}
              onDelete={(userId) => void handleDelete(userId)}
            />
          )}
        </div>
      </Card>

      <CreateUserDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(created) => {
          setUsers((previous) => [created, ...previous])
          setActionMessage({
            tone: 'success',
            text: `Usuario ${created.email} creado correctamente.`,
          })
        }}
      />
    </div>
  )
}

export default AdminUsers
