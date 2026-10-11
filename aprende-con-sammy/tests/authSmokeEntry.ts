/**
 * ============================================================
 *  Punto de entrada empaquetado por esbuild
 * ============================================================
 *  Ejecuta UN escenario contra el mock cuya URL llega por argv y escribe el
 *  resultado como JSON en stdout. El mock vive en el proceso padre, que es
 *  quien registra las peticiones HTTP y verifica el protocolo.
 *
 *  Uso (generado por tests/run-auth-smoke.mts):
 *    node auth-smoke.mjs <escenario> <mockUrl>
 */
import { loginUser, registerUser } from '../src/lib/auth.ts'
import { performMainFlow } from './authSmoke.ts'

const PASSWORD = 'clave-segura-123'

const [scenario = '', mockUrl = ''] = process.argv.slice(2)

if (!scenario || !mockUrl) {
  process.stderr.write('Uso: auth-smoke.mjs <escenario> <mockUrl>\n')
  process.exit(1)
}

/** Resultado serializable del escenario ejecutado. */
type ScenarioOutput =
  | { scenario: 'main'; report: Awaited<ReturnType<typeof performMainFlow>> }
  | { scenario: 'invalid-credentials'; success: boolean; message: string; hasUser: boolean }
  | { scenario: 'rls-denied'; success: boolean; message: string; email: string | null }

let output: ScenarioOutput

if (scenario === 'main') {
  output = { scenario: 'main', report: await performMainFlow() }
} else if (scenario === 'invalid-credentials') {
  const result = await loginUser({
    email: 'ana.torres@sammy.cl',
    password: 'contraseña-incorrecta',
  })
  output = {
    scenario: 'invalid-credentials',
    success: result.success,
    message: result.message,
    hasUser: result.user !== undefined,
  }
} else if (scenario === 'rls-denied') {
  const result = await registerUser({
    fullName: 'Sofía Ríos',
    email: 'sofia@sammy.cl',
    password: PASSWORD,
    role: 'padre',
  })
  output = {
    scenario: 'rls-denied',
    success: result.success,
    message: result.message,
    email: result.user?.email ?? null,
  }
} else {
  process.stderr.write(`Escenario desconocido: ${scenario}\n`)
  process.exit(1)
}

process.stdout.write(JSON.stringify(output))
