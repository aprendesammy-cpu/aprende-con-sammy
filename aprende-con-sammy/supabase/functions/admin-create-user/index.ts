/**
 * ============================================================
 *  Edge Function: admin-create-user
 * ============================================================
 *  Crea una cuenta desde el panel de administración.
 *
 *  ¿Por qué una Edge Function y no el navegador?
 *  Escribir en `auth.users` exige la clave `service_role`, que ignora TODAS las
 *  políticas RLS. Si estuviera en el bundle del cliente, cualquiera podría
 *  extraerla del JavaScript y crear o borrar usuarios a voluntad. Aquí vive
 *  como secreto del servidor (`SUPABASE_SERVICE_ROLE_KEY`).
 *
 *  Despliegue:
 *    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<tu service_role key>
 *    supabase functions deploy admin-create-user
 *
 *  ⚠️ La clave service_role NUNCA se registra ni se devuelve en la respuesta.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

/** Cabeceras CORS: la función se invoca desde el navegador. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Roles que puede asignar un administrador. */
const VALID_ROLES = ['padre', 'educador', 'admin']

/** Longitud mínima de contraseña, coherente con el frontend. */
const MIN_PASSWORD_LENGTH = 8

/**
 * Responde con JSON y las cabeceras CORS.
 *
 * @param body Contenido de la respuesta.
 * @param status Código HTTP.
 */
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  // El navegador envía un preflight OPTIONS antes del POST.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Método no permitido.' }, 405)
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
      console.error('[admin-create-user] Faltan variables de entorno del proyecto.')
      return jsonResponse({ message: 'La función no está configurada correctamente.' }, 500)
    }

    // ── 1) Identificar a quien invoca con SU propio token ────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ message: 'Debes iniciar sesión para crear usuarios.' }, 401)
    }

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: callerData, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !callerData.user) {
      return jsonResponse({ message: 'Sesión inválida o expirada.' }, 401)
    }

    // ── 2) Verificar el rol admin en `public.users` ──────────────────────
    // El JWT no es suficiente: el rol autoritativo vive en la tabla `users`.
    const { data: callerProfile, error: profileError } = await callerClient
      .from('users')
      .select('role')
      .eq('id', callerData.user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[admin-create-user] Error al leer el perfil:', profileError.message)
      return jsonResponse({ message: 'No pudimos verificar tus permisos.' }, 500)
    }

    if (callerProfile?.role !== 'admin') {
      return jsonResponse(
        { message: 'Solo un administrador puede crear usuarios.' },
        403,
      )
    }

    // ── 3) Validar la entrada ────────────────────────────────────────────
    const body = (await req.json()) as Record<string, unknown>

    // REGLA 3 — normalización obligatoria del email.
    const email = String(body.email ?? '').toLowerCase().trim()
    const password = String(body.password ?? '')
    const fullName = String(body.full_name ?? '').replace(/\s+/g, ' ').trim()
    const firstName = String(body.name ?? '').replace(/\s+/g, ' ').trim()
    const role = String(body.role ?? '')
    const sala = role === 'educador' ? String(body.sala ?? '').replace(/\s+/g, ' ').trim() : null

    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
    if (!EMAIL_PATTERN.test(email)) {
      return jsonResponse({ message: 'El email no tiene un formato válido.' }, 400)
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return jsonResponse(
        { message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
        400,
      )
    }
    if (!fullName) {
      return jsonResponse({ message: 'Escribe el nombre completo.' }, 400)
    }
    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({ message: 'El rol indicado no es válido.' }, 400)
    }
    if (role === 'educador' && !sala) {
      return jsonResponse({ message: 'Indica la sala que lidera.' }, 400)
    }

    // ── 4) Crear la cuenta en auth.users con service_role ────────────────
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      // Se confirma de inmediato: el alta la hace un administrador, no el propio
      // usuario, así que no tiene sentido enviarle un correo de verificación.
      email_confirm: true,
      user_metadata: {
        name: firstName || fullName.split(' ')[0],
        full_name: fullName,
        role,
        ...(sala ? { sala } : {}),
      },
    })

    if (createError || !created.user) {
      console.error('[admin-create-user] Error al crear la cuenta:', createError?.message)

      const raw = String(createError?.message ?? '').toLowerCase()
      if (raw.includes('already registered') || raw.includes('already exists')) {
        return jsonResponse({ message: 'Este email ya tiene una cuenta registrada.' }, 409)
      }
      return jsonResponse({ message: 'No pudimos crear la cuenta.' }, 500)
    }

    // ── 5) Refuerzo defensivo sobre `public.users` ───────────────────────
    // El trigger `handle_new_auth_user` ya crea la fila; este upsert cubre el
    // caso de que el trigger falle o no exista.
    const { data: row, error: upsertError } = await adminClient
      .from('users')
      .upsert(
        {
          id: created.user.id,
          email,
          name: firstName || fullName.split(' ')[0],
          full_name: fullName,
          role,
          sala,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single()

    if (upsertError) {
      console.error('[admin-create-user] Error en el upsert de public.users:', upsertError.message)
    }

    return jsonResponse(
      row ?? {
        id: created.user.id,
        email,
        name: firstName || fullName.split(' ')[0],
        full_name: fullName,
        role,
        sala,
        created_at: created.user.created_at,
        updated_at: created.user.created_at,
      },
      201,
    )
  } catch (error) {
    // Se registra el mensaje, nunca el cuerpo de la petición: contiene contraseñas.
    console.error('[admin-create-user] Excepción inesperada:', error instanceof Error ? error.message : error)
    return jsonResponse({ message: 'Ocurrió un error inesperado en el servidor.' }, 500)
  }
})
