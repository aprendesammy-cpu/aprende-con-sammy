/**
 * ============================================================
 *  Runner de las pruebas de integración de auth
 * ============================================================
 *  Node no expone `import.meta.env` (es exclusivo del bundler de Vite), así que
 *  este script:
 *    1. Arranca mocks locales de Supabase en ESTE proceso.
 *    2. Empaqueta `tests/authSmokeEntry.ts` con esbuild inyectando
 *       `import.meta.env` apuntando al mock del escenario.
 *    3. Ejecuta el bundle en un proceso hijo.
 *    4. Verifica el protocolo HTTP usando el registro de peticiones del padre
 *       y los valores observados que devuelve el hijo.
 *
 *  Uso: node --import tsx tests/run-auth-smoke.mts
 *  Requiere Node >= 22 (WebSocket nativo para el cliente Realtime de Supabase).
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

import { startMockSupabase, type MockSupabase, type RecordedRequest } from './mockSupabase.ts'
import type { FlowReport } from './authSmoke.ts'

const projectRoot = path.dirname(
  fileURLToPath(new URL('../package.json', import.meta.url)),
)
const outfile = path.join(projectRoot, 'node_modules', '.tmp', 'auth-smoke.mjs')

interface CheckResult {
  name: string
  ok: boolean
  detail?: string
}

const results: CheckResult[] = []

/**
 * Registra el resultado de una comprobación.
 *
 * @param name Nombre legible de la prueba.
 * @param fn Cuerpo de la prueba.
 */
async function check(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn()
    results.push({ name, ok: true })
  } catch (error) {
    results.push({
      name,
      ok: false,
      detail:
        error instanceof Error
          ? error.message.replace(/\n\s*\n/g, ' | ').slice(0, 500)
          : String(error).slice(0, 500),
    })
  }
}

/**
 * Empaqueta el entry point y lo ejecuta contra un mock concreto.
 *
 * @param scenario Escenario a ejecutar en el hijo.
 * @param mock Mock ya iniciado por este proceso.
 * @returns Salida estándar del hijo, parseada como JSON.
 */
async function runScenario<T>(scenario: string, mock: MockSupabase): Promise<T> {
  await build({
    entryPoints: [path.join(projectRoot, 'tests', 'authSmokeEntry.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    outfile,
    logLevel: 'error',
    // Replica el alias "@" → ./src declarado en vite.config.ts y tsconfig.app.json
    alias: { '@': path.join(projectRoot, 'src') },
    // Inyecta `import.meta.env` tal como lo hace Vite en el navegador.
    define: {
      'import.meta.env': JSON.stringify({
        VITE_SUPABASE_URL: mock.url,
        VITE_SUPABASE_ANON_KEY: mock.anonKey,
        VITE_APP_ENV: 'development',
      }),
    },
  })

  const child = spawn(process.execPath, [outfile, scenario, mock.url], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'inherit'],
  })

  const chunks: Buffer[] = []
  child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', (code) => resolve(code ?? 1))
  })

  const raw = Buffer.concat(chunks).toString('utf8')

  if (exitCode !== 0) {
    throw new Error(`El escenario "${scenario}" terminó con código ${exitCode}: ${raw.slice(0, 300)}`)
  }

  return JSON.parse(raw) as T
}

/**
 * Busca peticiones registradas por el mock.
 *
 * @param mock Mock propietario del registro.
 * @param method Método HTTP.
 * @param url Pathname exacto.
 */
function findRequests(
  mock: MockSupabase,
  method: string,
  url: string,
): RecordedRequest[] {
  return mock.requests.filter((item) => item.method === method && item.url === url)
}

// ============================================================
// Escenario A — flujo principal
// ============================================================
const mockMain = await startMockSupabase({
  validCredentials: { email: 'ana.torres@sammy.cl', password: 'clave-segura-123' },
})

const main = await runScenario<{ scenario: 'main'; report: FlowReport }>('main', mockMain)
const report = main.report
const USER_ID = report.registeredId

assert.ok(USER_ID, 'el registro no devolvió un identificador de usuario')

await check('registerUser normaliza el email antes de enviarlo a Supabase', () => {
  const signup = findRequests(mockMain, 'POST', '/auth/v1/signup')[0]
  assert.ok(signup, 'no se llamó a /auth/v1/signup')

  const payload = signup.body as { email: string; data: Record<string, string> }
  assert.equal(payload.email, 'ana.torres@sammy.cl')
  assert.equal(payload.data.full_name, 'Ana María Torres')
  assert.equal(payload.data.name, 'Ana')
  assert.equal(payload.data.role, 'educador')
  assert.equal(payload.data.sala, 'Sala Arcoíris')
})

await check('registerUser hace upsert en la tabla `users`, nunca en `profiles`', () => {
  const upserts = findRequests(mockMain, 'POST', '/rest/v1/users')
  assert.ok(upserts.length > 0, 'no se hizo upsert en /rest/v1/users')
  assert.equal(
    mockMain.requests.filter((item) => item.url.includes('/rest/v1/profiles')).length,
    0,
    'se escribió en la tabla prohibida `profiles`',
  )

  // `.upsert(objeto)` envía el objeto suelto; `.upsert([objeto])` un array.
  const raw = upserts[0]?.body as
    | Partial<Record<string, string>>
    | Partial<Record<string, string>>[]
  const body = Array.isArray(raw) ? raw[0] : raw
  assert.equal(body?.id, USER_ID)
  assert.equal(body?.email, 'ana.torres@sammy.cl')
  assert.equal(body?.role, 'educador')
  assert.ok(upserts[0]?.query.on_conflict?.includes('id'), 'falta onConflict=id')
})

await check('registerUser devuelve éxito y el perfil persistido', () => {
  assert.equal(report.register.success, true, report.register.message)
  assert.ok(report.register.profileId, 'el resultado no incluyó perfil')
  assert.equal(report.register.profileId, USER_ID)
  assert.equal(report.register.profileEmail, 'ana.torres@sammy.cl')
  assert.equal(report.register.profileSala, 'Sala Arcoíris')
  assert.equal(report.register.profileRole, 'educador')
  assert.equal(report.register.requiresConfirmation, false)
})

await check('registerUser rechaza contraseña corta SIN llamar a la red', () => {
  assert.equal(report.shortPassword.success, false)
  assert.match(report.shortPassword.message, /al menos 8 caracteres/)
  // Alcanzan la red: Ana, el reintento de Ana (rechazado por el servidor) y Carlos.
  // Pedro (contraseña corta), Laura (sin sala) y el email inválido se rechazan en
  // la validación previa, sin consumir cuota ni latencia.
  assert.equal(
    findRequests(mockMain, 'POST', '/auth/v1/signup').length,
    3,
    'un registro inválido alcanzó la red',
  )
})

await check('registerUser detecta un email ya registrado y lo traduce a español', () => {
  assert.equal(report.reRegister.success, false)
  assert.equal(
    report.reRegister.message,
    'Este email ya tiene una cuenta. Inicia sesión o recupera tu contraseña.',
  )
  assert.equal(report.reRegister.profileId, null)
})

await check('registerUser exige la sala cuando el rol es educador', () => {
  assert.equal(report.educatorWithoutSala.success, false)
  assert.match(report.educatorWithoutSala.message, /sala que lideras/)
})

await check('registerUser no requiere sala cuando el rol es padre', () => {
  assert.equal(report.fatherWithoutSala.success, true)
  assert.equal(report.fatherWithoutSala.sala, null)
})

await check('registerUser rechaza un email con formato inválido', () => {
  assert.equal(report.invalidEmail.success, false)
  assert.match(report.invalidEmail.message, /formato válido/)
})

await check('loginUser normaliza el email y devuelve el perfil', () => {
  assert.equal(report.login.success, true)
  assert.equal(report.login.profileEmail, 'ana.torres@sammy.cl')

  const token = findRequests(mockMain, 'POST', '/auth/v1/token')[0]
  assert.ok(token, 'no se llamó a /auth/v1/token')
  const sent = {
    ...token.query,
    ...((token.body ?? {}) as Record<string, string>),
  }
  assert.equal(sent.email, 'ana.torres@sammy.cl')
})

await check('getCurrentUser devuelve la sesión activa', () => {
  assert.equal(report.currentSessionEmail, 'ana.torres@sammy.cl')
  assert.equal(report.currentSessionRole, 'educador')
  assert.equal(report.helpers.roleFromNull, null)
  assert.ok(
    findRequests(mockMain, 'GET', '/auth/v1/user').length > 0,
    'no se validó la sesión contra el servidor',
  )
})

await check('getUserProfile filtra por id en `public.users`', () => {
  assert.equal(report.profileById.role, 'educador')
  assert.equal(report.profileById.fullName, 'Ana María Torres')
  assert.equal(report.profileMissingId, true)

  const reads = findRequests(mockMain, 'GET', '/rest/v1/users')
  assert.ok(reads.length > 0, 'no se leyó /rest/v1/users')
  assert.ok(
    reads.some((item) => item.query.id === `eq.${USER_ID}`),
    'la lectura no filtró por id',
  )
  assert.ok(
    reads.some((item) => item.query.id === 'eq.00000000-0000-0000-0000-000000000000'),
    'no se consultó el id inexistente',
  )
})

await check('Helpers de rol y nombre se comportan correctamente', () => {
  assert.equal(report.helpers.isEducator, true)
  assert.equal(report.helpers.isAdmin, false)
  assert.equal(report.helpers.displayName, 'Ana')
  assert.equal(report.helpers.fallback, 'Familia Sammy')
})

await check('resetPassword normaliza el email y no revela si la cuenta existe', () => {
  assert.equal(report.resetUnknownEmail.success, true)
  assert.match(report.resetUnknownEmail.message, /recibirás un enlace/)
  assert.equal(report.resetInvalidEmail.success, false)

  const recover = findRequests(mockMain, 'POST', '/auth/v1/recover')[0]
  assert.ok(recover, 'no se llamó a /auth/v1/recover')
  const payload = recover.body as { email: string }
  assert.equal(payload.email, 'desconocido@sammy.cl')
})

await check('logoutUser cierra la sesión', () => {
  assert.equal(report.logout.success, true)
  assert.equal(report.logout.sessionAfter, false)
  assert.ok(
    findRequests(mockMain, 'POST', '/auth/v1/logout').length > 0,
    'no se llamó a /auth/v1/logout',
  )
})

await mockMain.close()

// ============================================================
// Escenario B — credenciales inválidas
// ============================================================
const mockBadLogin = await startMockSupabase({
  validCredentials: { email: 'ana.torres@sammy.cl', password: 'clave-segura-123' },
})

const badLogin = await runScenario<{
  scenario: 'invalid-credentials'
  success: boolean
  message: string
  hasUser: boolean
}>('invalid-credentials', mockBadLogin)

await check('loginUser traduce credenciales inválidas a un mensaje en español', () => {
  assert.equal(badLogin.success, false)
  assert.equal(badLogin.message, 'Email o contraseña incorrectos. Inténtalo de nuevo.')
  assert.equal(badLogin.hasUser, false)

  const token = findRequests(mockBadLogin, 'POST', '/auth/v1/token')[0]
  assert.ok(token, 'no se llamó a /auth/v1/token')
  const sent = {
    ...token.query,
    ...((token.body ?? {}) as Record<string, string>),
  }
  assert.equal(sent.password, 'contraseña-incorrecta')
})

await mockBadLogin.close()

// ============================================================
// Escenario C — upsert denegado por RLS
// ============================================================
const mockRls = await startMockSupabase({ failUsersUpsert: true })

const rls = await runScenario<{
  scenario: 'rls-denied'
  success: boolean
  message: string
  email: string | null
}>('rls-denied', mockRls)

await check('registerUser NO aborta si el upsert defensivo falla por RLS', () => {
  assert.equal(rls.success, true, rls.message)
  assert.equal(rls.email, 'sofia@sammy.cl')
  assert.ok(
    findRequests(mockRls, 'POST', '/rest/v1/users').length > 0,
    'no se intentó el upsert',
  )
})

await mockRls.close()

// ============================================================
// Reporte
// ============================================================
const passed = results.filter((item) => item.ok).length
const failed = results.length - passed

process.stdout.write('\n')
for (const item of results) {
  process.stdout.write(`${item.ok ? '  ✅' : '  ❌'} ${item.name}\n`)
  if (!item.ok && item.detail) {
    process.stdout.write(`      → ${item.detail}\n`)
  }
}
process.stdout.write(
  `\n# integration: ${passed} pass, ${failed} fail, ${results.length} total\n`,
)

if (failed > 0) {
  process.exitCode = 1
}
