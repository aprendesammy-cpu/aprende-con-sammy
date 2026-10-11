import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'

/**
 * ============================================================
 *  Mock de Supabase para pruebas de integración
 * ============================================================
 *  Simula el protocolo REAL de los endpoints que consume la app:
 *   - POST /auth/v1/signup                        (auth.signUp)
 *   - POST /auth/v1/token?grant_type=password     (auth.signInWithPassword)
 *       ⚠️ las credenciales viajan en la QUERY STRING, no en el body
 *   - GET  /auth/v1/user                          (auth.getUser)
 *   - POST /auth/v1/recover                       (auth.resetPasswordForEmail)
 *   - POST /auth/v1/logout                        (auth.signOut)
 *   - *    /rest/v1/users                         (from('users'))
 *       ⚠️ los filtros viajan como `?id=eq.<uuid>` / `?email=eq.<email>`
 *
 *  Registra cada petición para poder afirmar qué envió realmente el cliente.
 */

export interface RecordedRequest {
  method: string
  url: string
  query: Record<string, string>
  body: unknown
}

export interface MockProfileRow {
  id: string
  email: string
  name: string | null
  full_name: string | null
  role: string
  sala: string | null
  created_at: string
  updated_at: string
}

export interface MockOptions {
  /** Si es true, POST /rest/v1/users responde 403 (simula RLS denegada). */
  failUsersUpsert?: boolean
  /** Credenciales válidas para el login; cualquier otra combinacion se rechaza. */
  validCredentials?: { email: string; password: string }
}

export interface MockSupabase {
  url: string
  anonKey: string
  requests: RecordedRequest[]
  /** Filas presentes en la "tabla" users. */
  rows: MockProfileRow[]
  close: () => Promise<void>
}

const NOW = '2026-10-11T00:00:00.000000+00:00'

function buildAuthUser(id: string, email: string, metadata: Record<string, unknown>) {
  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: NOW,
    phone: '',
    confirmed_at: NOW,
    last_sign_in_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    is_anonymous: false,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: metadata,
    identities: [],
  }
}

function buildSession(id: string, email: string, metadata: Record<string, unknown>) {
  return {
    access_token: `mock-access-token-${id}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `mock-refresh-token-${id}`,
    user: buildAuthUser(id, email, metadata),
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

/**
 * Interpreta los filtros de PostgREST (`columna=eq.valor`).
 *
 * @param query Parámetros de la URL.
 * @returns Pares columna/valor esperados.
 */
function parsePostgrestFilters(query: Record<string, string>): [string, string][] {
  return Object.entries(query)
    .filter(([key, value]) => key !== 'select' && value.startsWith('eq.'))
    .map(([key, value]) => [key, value.slice(3)] as [string, string])
}

/**
 * Arranca el mock y devuelve su URL local.
 *
 * @param options Comportamiento del mock.
 */
export async function startMockSupabase(options: MockOptions = {}): Promise<MockSupabase> {
  const requests: RecordedRequest[] = []
  const rows: MockProfileRow[] = []
  let currentSession: ReturnType<typeof buildSession> | null = null

  const server: Server = createServer((req, res) => {
    void handle(req, res)
  })

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const rawUrl = req.url ?? ''
    const method = req.method ?? 'GET'
    const [pathname, search = ''] = rawUrl.split('?')
    const query = Object.fromEntries(new URLSearchParams(search))
    const body = await readBody(req)
    requests.push({ method, url: pathname, query, body })

    // --- Auth: registro -------------------------------------------------
    if (method === 'POST' && pathname === '/auth/v1/signup') {
      const payload = (body ?? {}) as {
        email?: string
        password?: string
        data?: Record<string, unknown>
      }
      const email = payload.email ?? ''
      const metadata = payload.data ?? {}

      // GoTrue responde 422 cuando el email ya está registrado.
      if (rows.some((item) => item.email === email)) {
        sendJson(res, 422, {
          error: 'User already registered',
          error_code: 'user_already_exists',
          error_description: 'User already registered',
          msg: 'User already registered',
        })
        return
      }

      // El trigger `handle_new_auth_user` crearía la fila; aquí se simula.
      const newId = randomUUID()
      rows.push({
        id: newId,
        email,
        name: typeof metadata.name === 'string' ? metadata.name : null,
        full_name: typeof metadata.full_name === 'string' ? metadata.full_name : null,
        role: typeof metadata.role === 'string' ? metadata.role : 'padre',
        sala: typeof metadata.sala === 'string' ? metadata.sala : null,
        created_at: NOW,
        updated_at: NOW,
      })

      const session = buildSession(newId, email, metadata)
      // Un signUp sin confirmación de email no establece sesión; con confirmación
      // desactivada sí. Se actualiza el estado solo si no había sesión previa,
      // para que un login posterior siga siendo la fuente de verdad.
      if (!currentSession) {
        currentSession = session
      }
      sendJson(res, 200, session)
      return
    }

    // --- Auth: login (credenciales en la query string o en el body) -------
    if (method === 'POST' && pathname === '/auth/v1/token') {
      // Según la versión del cliente las credenciales viajan en la query o en el body.
      const bodyCredentials = (body ?? {}) as { email?: string; password?: string }
      const email = query.email ?? bodyCredentials.email ?? ''
      const password = query.password ?? bodyCredentials.password ?? ''
      const valid = options.validCredentials

      if (valid && (email !== valid.email || password !== valid.password)) {
        sendJson(res, 400, {
          error: 'invalid_grant',
          error_code: 'invalid_credentials',
          error_description: 'Invalid login credentials',
          msg: 'Invalid login credentials',
        })
        return
      }

      const row = rows.find((item) => item.email === email)
      const sessionId = row?.id ?? randomUUID()
      const metadata: Record<string, unknown> = {
        name: row?.name ?? '',
        full_name: row?.full_name ?? '',
        role: row?.role ?? 'padre',
      }
      if (row?.sala) {
        metadata.sala = row.sala
      }

      currentSession = buildSession(sessionId, email, metadata)
      sendJson(res, 200, currentSession)
      return
    }

    // --- Auth: usuario de la sesión activa ------------------------------
    if (method === 'GET' && pathname === '/auth/v1/user') {
      if (!currentSession) {
        sendJson(res, 401, {
          error: 'invalid_token',
          error_description: 'Access token not provided',
          msg: 'Access token not provided',
        })
        return
      }
      sendJson(res, 200, currentSession.user)
      return
    }

    // --- Auth: recuperación de contraseña -------------------------------
    if (method === 'POST' && pathname === '/auth/v1/recover') {
      // Supabase responde 200 con `{}` y NO revela si el email existe.
      sendJson(res, 200, {})
      return
    }

    // --- Auth: logout ----------------------------------------------------
    if (method === 'POST' && pathname === '/auth/v1/logout') {
      currentSession = null
      res.writeHead(204)
      res.end()
      return
    }

    // --- REST: tabla users ----------------------------------------------
    if (pathname === '/rest/v1/users') {
      if (method === 'POST') {
        if (options.failUsersUpsert === true) {
          sendJson(res, 403, {
            code: '42501',
            details: null,
            hint: null,
            message: 'new row violates row-level security policy for table "users"',
          })
          return
        }

        const payload = (body ?? {}) as Partial<MockProfileRow> | Partial<MockProfileRow>[]
        const incoming = Array.isArray(payload) ? payload[0] : payload
        const id = incoming?.id ?? randomUUID()
        const index = rows.findIndex((item) => item.id === id)
        const merged: MockProfileRow = {
          id,
          email: incoming?.email ?? rows[index]?.email ?? '',
          name: incoming?.name ?? rows[index]?.name ?? null,
          full_name: incoming?.full_name ?? rows[index]?.full_name ?? null,
          role: incoming?.role ?? rows[index]?.role ?? 'padre',
          sala: incoming?.sala ?? rows[index]?.sala ?? null,
          created_at: rows[index]?.created_at ?? NOW,
          updated_at: NOW,
        }

        if (index >= 0) {
          rows[index] = merged
        } else {
          rows.push(merged)
        }

        const wantsObject = String(req.headers.accept ?? '').includes(
          'application/vnd.pgrst.object+json',
        )
        sendJson(res, 201, wantsObject ? merged : [merged])
        return
      }

      if (method === 'GET' || method === 'HEAD') {
        const filters = parsePostgrestFilters(query)
        const filtered = rows.filter((row) =>
          filters.every(([column, value]) =>
            column === 'id'
              ? row.id === value
              : column === 'email'
                ? row.email === value
                : String(row[column as keyof MockProfileRow] ?? '') === value,
          ),
        )

        // PostgREST: si el cliente pidió un único objeto (.single/.maybeSingle)
        // responde el objeto suelto, o 406 PGRST116 cuando no hay exactamente uno.
        const wantsObject = String(req.headers.accept ?? '').includes(
          'application/vnd.pgrst.object+json',
        )

        if (wantsObject) {
          if (filtered.length !== 1) {
            sendJson(res, 406, {
              code: 'PGRST116',
              details: `Results contain ${filtered.length} rows, application/vnd.pgrst.object+json requires 1 row`,
              hint: null,
              message: 'JSON object requested, multiple (or no) rows returned',
            })
            return
          }
          sendJson(res, 200, filtered[0])
          return
        }

        sendJson(res, 200, filtered)
        return
      }

      if (method === 'PATCH' || method === 'DELETE') {
        sendJson(res, 200, rows)
        return
      }
    }

    sendJson(res, 404, { message: `Ruta no simulada: ${method} ${pathname}` })
  }

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${address.port}`,
    anonKey: 'mock-anon-key',
    requests,
    rows,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}
