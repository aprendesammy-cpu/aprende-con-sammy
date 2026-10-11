/**
 * ============================================================
 *  Escenario principal: ejecución del flujo de autenticación
 * ============================================================
 *  Se ejecuta en el proceso HIJO (donde `import.meta.env` está inyectado).
 *  Aquí solo se realizan las operaciones y se devuelven los valores observados;
 *  las aserciones sobre el protocolo HTTP las hace el PADRE, que es quien
 *  posee el registro de peticiones del mock. Ver tests/run-auth-smoke.mts.
 *
 *  El orden importa: el identificador del usuario registrado se reutiliza en
 *  las lecturas posteriores, tal como haría la aplicación real.
 */
import {
  getDisplayName,
  getRoleFromUser,
  isAdmin,
  isEducator,
  getCurrentUser,
  getUserProfile,
  loginUser,
  logoutUser,
  registerUser,
  resetPassword,
} from '../src/lib/auth.ts'

const PASSWORD = 'clave-segura-123'

/** Valores observados durante el flujo, para que el padre los verifique. */
export interface FlowReport {
  registeredId: string | null
  register: {
    success: boolean
    message: string
    profileId: string | null
    profileSala: string | null
    profileRole: string | null
    profileEmail: string | null
    requiresConfirmation: boolean | undefined
  }
  reRegister: {
    success: boolean
    message: string
    profileId: string | null
    profileSala: string | null
  }
  shortPassword: { success: boolean; message: string }
  educatorWithoutSala: { success: boolean; message: string }
  fatherWithoutSala: { success: boolean; sala: string | null }
  invalidEmail: { success: boolean; message: string }
  login: { success: boolean; message: string; profileEmail: string | null }
  currentSessionEmail: string | null
  currentSessionRole: string | null
  profileById: { role: string | null; fullName: string | null; sala: string | null }
  profileMissingId: boolean
  helpers: {
    isEducator: boolean
    isAdmin: boolean
    displayName: string
    fallback: string
    roleFromNull: string | null
  }
  resetUnknownEmail: { success: boolean; message: string }
  resetInvalidEmail: { success: boolean }
  logout: { success: boolean; sessionAfter: boolean }
}

/**
 * Ejecuta el flujo completo contra el Supabase configurado en `import.meta.env`.
 *
 * @returns Informe con los valores observados en cada paso.
 */
export async function performMainFlow(): Promise<FlowReport> {
  // 1) Registro de una educadora, con email y nombre deliberadamente sucios.
  const register = await registerUser({
    fullName: '  Ana   María Torres ',
    email: '  Ana.Torres@SAMMY.CL ',
    password: PASSWORD,
    role: 'educador',
    sala: '  Sala Arcoíris  ',
  })

  const registeredId = register.user?.id ?? null

  // 2) Segundo registro del mismo usuario (idempotencia del upsert).
  const reRegister = await registerUser({
    fullName: 'Ana María Torres',
    email: 'ana.torres@sammy.cl',
    password: PASSWORD,
    role: 'educador',
    sala: 'Sala Arcoíris',
  })

  // 3) Validaciones que NO deben alcanzar la red.
  const shortPassword = await registerUser({
    fullName: 'Pedro Pérez',
    email: 'pedro@sammy.cl',
    password: '123',
    role: 'padre',
  })

  const educatorWithoutSala = await registerUser({
    fullName: 'Laura Silva',
    email: 'laura@sammy.cl',
    password: PASSWORD,
    role: 'educador',
  })

  const invalidEmail = await registerUser({
    fullName: 'Inválido',
    email: 'correo-sin-arroba',
    password: PASSWORD,
    role: 'padre',
  })

  // 4) Rol padre: la sala no aplica.
  const fatherWithoutSala = await registerUser({
    fullName: 'Carlos Muñoz',
    email: 'carlos@sammy.cl',
    password: PASSWORD,
    role: 'padre',
  })

  // 5) Login con el email en mayúsculas y con espacios.
  const login = await loginUser({
    email: '  ANA.TORRES@sammy.cl  ',
    password: PASSWORD,
  })

  // 6) Lecturas con la sesión ya establecida por el login.
  const currentUser = await getCurrentUser()
  const profile = registeredId ? await getUserProfile(registeredId) : null
  const missingProfile = await getUserProfile('00000000-0000-0000-0000-000000000000')

  // 7) Recuperación de contraseña.
  const resetUnknownEmail = await resetPassword('  DESCONOCIDO@sammy.cl ')
  const resetInvalidEmail = await resetPassword('no-es-un-email')

  // 8) Cierre de sesión, siempre al final.
  const logout = await logoutUser()
  const sessionAfterLogout = await getCurrentUser()

  return {
    registeredId,
    register: {
      success: register.success,
      message: register.message,
      profileId: register.profile?.id ?? null,
      profileSala: register.profile?.sala ?? null,
      profileRole: register.profile?.role ?? null,
      profileEmail: register.profile?.email ?? null,
      requiresConfirmation: register.requiresConfirmation,
    },
    reRegister: {
      success: reRegister.success,
      message: reRegister.message,
      profileId: reRegister.profile?.id ?? null,
      profileSala: reRegister.profile?.sala ?? null,
    },
    shortPassword: { success: shortPassword.success, message: shortPassword.message },
    educatorWithoutSala: {
      success: educatorWithoutSala.success,
      message: educatorWithoutSala.message,
    },
    fatherWithoutSala: {
      success: fatherWithoutSala.success,
      sala: fatherWithoutSala.profile?.sala ?? null,
    },
    invalidEmail: { success: invalidEmail.success, message: invalidEmail.message },
    login: {
      success: login.success,
      message: login.message,
      profileEmail: login.profile?.email ?? null,
    },
    currentSessionEmail: currentUser?.email ?? null,
    currentSessionRole: getRoleFromUser(currentUser),
    profileById: {
      role: profile?.role ?? null,
      fullName: profile?.full_name ?? null,
      sala: profile?.sala ?? null,
    },
    profileMissingId: missingProfile === null,
    helpers: {
      isEducator: isEducator(profile),
      isAdmin: isAdmin(profile),
      displayName: getDisplayName(profile),
      fallback: getDisplayName(null, 'Familia Sammy'),
      roleFromNull: getRoleFromUser(null),
    },
    resetUnknownEmail: {
      success: resetUnknownEmail.success,
      message: resetUnknownEmail.message,
    },
    resetInvalidEmail: { success: resetInvalidEmail.success },
    logout: {
      success: logout.success,
      sessionAfter: sessionAfterLogout !== null,
    },
  }
}
