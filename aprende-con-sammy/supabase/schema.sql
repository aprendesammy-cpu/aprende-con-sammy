-- ============================================================
--  APRENDE CON SAMMY — SCRIPT SQL MAESTRO
--  PostgreSQL 15+ / Supabase
-- ============================================================
--  Copiar y pegar COMPLETO en: Supabase Dashboard → SQL Editor → New query
--
--  Contenido:
--    0. Preparación y funciones auxiliares
--    1. Tabla `public.users` + RLS + triggers          ← PASO 6 del plan
--    2. Tablas del dominio (9)                          ← ADR-006, alcance ampliado
--    3. Índices
--    4. Publicación en Realtime
--    5. Datos semilla
--    6. Promoción del primer administrador
--    7. Verificación
--
--  ⚠️  ESTE SCRIPT ES DESTRUCTIVO: empieza con DROP TABLE.
--      Úsalo tal cual en un proyecto NUEVO o de desarrollo. Para aplicar
--      cambios en producción, extrae solo las secciones que necesites.
--
--  REGLAS DEL PROYECTO QUE ESTE SCRIPT RESPETA:
--    1. La tabla se llama SIEMPRE `users`. Nunca `profiles`.
--    3. El email se normaliza también en la base de datos (lower + trim),
--       como segunda línea de defensa frente a la normalización del cliente.
-- ============================================================


-- ============================================================
--  SECCIÓN 0 · PREPARACIÓN Y FUNCIONES AUXILIARES
-- ============================================================

-- Se eliminan en orden inverso de dependencia para que la re-ejecución sea limpia.
DROP TABLE IF EXISTS public.documents  CASCADE;
DROP TABLE IF EXISTS public.payments   CASCADE;
DROP TABLE IF EXISTS public.notes      CASCADE;
DROP TABLE IF EXISTS public.articles   CASCADE;
DROP TABLE IF EXISTS public.resources  CASCADE;
DROP TABLE IF EXISTS public.progress   CASCADE;
DROP TABLE IF EXISTS public.sessions   CASCADE;
DROP TABLE IF EXISTS public.subjects   CASCADE;
DROP TABLE IF EXISTS public.children   CASCADE;

-- (1) del plan: limpiar cualquier basura anterior.
DROP TABLE IF EXISTS public.users      CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_auth_user()  CASCADE;
DROP FUNCTION IF EXISTS public.handle_users_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at()        CASCADE;
DROP FUNCTION IF EXISTS public.normalize_user_email()  CASCADE;
DROP FUNCTION IF EXISTS public.is_admin()              CASCADE;
DROP FUNCTION IF EXISTS public.is_educator()           CASCADE;
DROP FUNCTION IF EXISTS public.current_sala()          CASCADE;
DROP FUNCTION IF EXISTS public.current_role()          CASCADE;
DROP FUNCTION IF EXISTS public.can_view_child(uuid)    CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ────────────────────────────────────────────────────────────
--  Funciones auxiliares de autorización
-- ────────────────────────────────────────────────────────────
--  Son SECURITY DEFINER a propósito: una política sobre `public.users` que
--  consultara `public.users` directamente se llamaría a sí misma y entraría
--  en recursión infinita. Al ejecutarse con los privilegios del propietario
--  (postgres), estas funciones sortean RLS y rompen el ciclo.
--
--  `SET search_path = public, pg_temp` es obligatorio en SECURITY DEFINER:
--  sin él, un atacante con permiso de creación en otro esquema podría
--  secuestrar la resolución de nombres. `pg_temp` va al final para que los
--  objetos temporales no tengan prioridad.
--
--  STABLE (no VOLATILE) permite que Postgres las evalúe una vez por consulta.

/** Rol del usuario autenticado, o NULL si no tiene fila en `public.users`. */
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.role FROM public.users u WHERE u.id = auth.uid()
$$;

/** ¿Es administrador quien invoca? */
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_role() = 'admin', false)
$$;

/** ¿Es educador quien invoca? */
CREATE OR REPLACE FUNCTION public.is_educator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_role() = 'educador', false)
$$;

/** Sala que lidera el educador autenticado. */
CREATE OR REPLACE FUNCTION public.current_sala()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.sala FROM public.users u WHERE u.id = auth.uid()
$$;

/**
 * ¿Puede quien invoca ver los datos de un niño concreto?
 *
 * Centraliza la regla de privacidad de menores (ADR-007) para que las tablas
 * `sessions`, `progress`, `notes` y `documents` no la dupliquen.
 */
CREATE OR REPLACE FUNCTION public.can_view_child(p_child_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.children c
    WHERE c.id = p_child_id
      AND (
            c.parent_id   = auth.uid()
         OR c.educator_id = auth.uid()
         OR public.is_admin()
      )
  )
$$;


-- ============================================================
--  SECCIÓN 1 · TABLA `public.users`
-- ============================================================

-- (2) del plan.
CREATE TABLE public.users (
  id         uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email      text        NOT NULL UNIQUE,
  name       text,
  full_name  text,
  role       text        NOT NULL DEFAULT 'padre'
                         CHECK (role IN ('padre', 'educador', 'admin')),
  sala       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Coherencia de datos: solo un educador tiene sala.
  CONSTRAINT users_sala_solo_educador
    CHECK (role = 'educador' OR sala IS NULL)
);

COMMENT ON TABLE  public.users           IS 'Usuarios de la plataforma (padres, educadores y administradores). NUNCA renombrar a profiles.';
COMMENT ON COLUMN public.users.id        IS 'PK y referencia a auth.users(id).';
COMMENT ON COLUMN public.users.email     IS 'Email normalizado: lower(trim()). Único.';
COMMENT ON COLUMN public.users.role      IS 'padre | educador | admin (ADR-003).';
COMMENT ON COLUMN public.users.sala      IS 'Sala que lidera. Obligatorio para educador, NULL para el resto.';

-- Índice para el filtrado por sala (listados de educadores).
CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);
CREATE INDEX IF NOT EXISTS users_sala_idx ON public.users (sala) WHERE sala IS NOT NULL;


-- ────────────────────────────────────────────────────────────
--  1.1 Normalización del email en la base de datos
-- ────────────────────────────────────────────────────────────
--  Regla 3 del proyecto. El cliente ya normaliza, pero la base de datos es la
--  última línea de defensa: un registro creado por la Edge Function, por un
--  script o por `psql` también queda normalizado. Sin esto, `UNIQUE` trataría
--  "Ana@X.cl" y "ana@x.cl" como cuentas distintas.

CREATE OR REPLACE FUNCTION public.normalize_user_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));

  -- El nombre completo se sanea igual que en el cliente: espacios colapsados.
  IF NEW.full_name IS NOT NULL THEN
    NEW.full_name := btrim(regexp_replace(NEW.full_name, '\s+', ' ', 'g'));
  END IF;
  IF NEW.name IS NOT NULL THEN
    NEW.name := btrim(regexp_replace(NEW.name, '\s+', ' ', 'g'));
  END IF;
  IF NEW.sala IS NOT NULL THEN
    NEW.sala := btrim(regexp_replace(NEW.sala, '\s+', ' ', 'g'));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_normalize_email ON public.users;
CREATE TRIGGER users_normalize_email
  BEFORE INSERT OR UPDATE OF email, full_name, name, sala ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.normalize_user_email();


-- ────────────────────────────────────────────────────────────
--  1.2 Trigger de `updated_at` (5) del plan
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_users_updated_at();

/** Versión genérica reutilizada por las tablas del dominio. */
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────
--  1.3 Trigger de alta automática desde auth.users (6) del plan
-- ────────────────────────────────────────────────────────────
--  Se dispara en cuanto GoTrue crea la cuenta, usando `raw_user_meta_data`.
--  Es la razón de que el registro funcione aunque el `upsert` del cliente sea
--  rechazado por RLS (por ejemplo, cuando la confirmación de email está activa
--  y todavía no hay sesión).

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_full_name text;
  v_name      text;
  v_role      text;
  v_sala      text;
BEGIN
  v_full_name := nullif(btrim(coalesce(NEW.raw_user_meta_data ->> 'full_name', '')), '');
  v_name      := nullif(btrim(coalesce(NEW.raw_user_meta_data ->> 'name',      '')), '');
  v_role      := lower(btrim(coalesce(NEW.raw_user_meta_data ->> 'role', 'padre')));
  v_sala      := nullif(btrim(coalesce(NEW.raw_user_meta_data ->> 'sala',     '')), '');

  -- Un metadata manipulado no puede crear un rol inexistente: el CHECK de la
  -- columna rechazaría la fila y el alta entera fallaría. Se degrada a 'padre'.
  IF v_role NOT IN ('padre', 'educador', 'admin') THEN
    v_role := 'padre';
  END IF;

  -- Solo un educador lleva sala (coherente con users_sala_solo_educador).
  IF v_role <> 'educador' THEN
    v_sala := NULL;
  END IF;

  IF v_full_name IS NULL THEN
    v_full_name := coalesce(NEW.email, 'Sin nombre');
  END IF;
  IF v_name IS NULL THEN
    v_name := split_part(v_full_name, ' ', 1);
  END IF;

  INSERT INTO public.users (id, email, name, full_name, role, sala)
  VALUES (
    NEW.id,
    lower(btrim(coalesce(NEW.email, ''))),
    v_name,
    v_full_name,
    v_role,
    v_sala
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Un re-alta no debe borrar datos ya curados ni degradar un rol existente.
    name      = coalesce(public.users.name, EXCLUDED.name),
    full_name = coalesce(public.users.full_name, EXCLUDED.full_name),
    role      = public.users.role,
    sala      = coalesce(public.users.sala, EXCLUDED.sala);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- ────────────────────────────────────────────────────────────
--  1.4 Row Level Security (3) y (4) del plan
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--  ⚠️ Deliberadamente NO se usa `FORCE ROW LEVEL SECURITY`.
--  El trigger `handle_new_auth_user` es SECURITY DEFINER: se ejecuta como
--  `postgres`, propietario de la tabla. Con FORCE, su INSERT quedaría sujeto a
--  la política `users_insert` (`id = auth.uid() OR is_admin()`), y en el
--  instante en que GoTrue crea la cuenta en `auth.users` todavía NO existe JWT:
--  `auth.uid()` es NULL. El alta sería rechazada y nadie podría registrarse.
--  ENABLE es suficiente: RLS aplica a los roles `anon` y `authenticated`, que
--  son los únicos que usa la aplicación.

DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;
DROP POLICY IF EXISTS users_delete ON public.users;

-- ── SELECT ──────────────────────────────────────────────────
--  ⚠️ DECISIÓN DE SEGURIDAD (ADR-011).
--  El plan pedía "Select: todos los autenticados". Se implementa una versión
--  más estricta porque la tabla contiene email y nombre de TODAS las personas
--  adultas de la comunidad educativa: exponerlos a cualquier cuenta
--  autenticada es una fuga de datos personales (GDPR / Ley 19.628) y facilita
--  el phishing dirigido a familias.
--
--  Ninguna pantalla de la aplicación necesita el listado completo salvo
--  Gestión de Usuarios, que ya es solo para admin.
--
--  Si más adelante se necesitara la versión permisiva del plan, sustituir el
--  cuerpo de esta política por:  USING (auth.role() = 'authenticated')
CREATE POLICY users_select ON public.users
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()          -- cada usuario ve su propia fila
    OR public.is_admin()     -- el administrador ve todas
  );

-- ── INSERT ──────────────────────────────────────────────────
--  Solo el dueño de la fila (el upsert defensivo del registro) o un admin
--  (alta manual vía Edge Function, que en realidad usa service_role y sortea
--  RLS; se incluye por si se invoca con un token de admin).
CREATE POLICY users_insert ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR public.is_admin()
  );

-- ── UPDATE ──────────────────────────────────────────────────
--  Dueño de la fila O admin, como pide el plan.
--  Se añade una condición importante: un usuario NO puede cambiar su propio
--  rol. Sin ella, cualquiera se promovería a admin con un UPDATE desde la
--  consola del navegador.
CREATE POLICY users_update ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() OR public.is_admin()
  )
  WITH CHECK (
    (id = auth.uid() OR public.is_admin())
    AND (
      public.is_admin()                        -- un admin sí puede asignar roles
      OR role = public.current_role()          -- el resto mantiene su propio rol
    )
  );

-- ── DELETE ──────────────────────────────────────────────────
--  Solo admin, como pide el plan.
CREATE POLICY users_delete ON public.users
  FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ============================================================
--  SECCIÓN 2 · TABLAS DEL DOMINIO
-- ============================================================

-- ────────────────────────────────────────────────────────────
--  2.1 children — datos de menores (ADR-007: la tabla más sensible)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.children (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    uuid        NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  educator_id  uuid                 REFERENCES public.users (id) ON DELETE SET NULL,
  first_name   text        NOT NULL,
  last_name    text,
  birth_date   date,
  avatar_url   text,
  sala         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.children IS 'Datos de menores. Nunca almacenar aquí información que deba ir en auth.users.';

ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

CREATE POLICY children_select ON public.children
  FOR SELECT TO authenticated
  USING (
    parent_id   = auth.uid()
    OR educator_id = auth.uid()
    OR public.is_admin()
    -- Un educador ve a los niños de su sala.
    OR (public.is_educator() AND sala IS NOT NULL AND sala = public.current_sala())
  );

-- Vincular un niño lo hace el centro educativo, no la familia desde la app.
CREATE POLICY children_insert ON public.children
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_educator());

CREATE POLICY children_update ON public.children
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_educator() OR parent_id = auth.uid())
  WITH CHECK (public.is_admin() OR public.is_educator() OR parent_id = auth.uid());

CREATE POLICY children_delete ON public.children
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ────────────────────────────────────────────────────────────
--  2.2 subjects — materias y categorías de contenido
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.subjects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  category    text        NOT NULL DEFAULT 'general',
  icon        text,
  color       text        NOT NULL DEFAULT 'primary',
  order_index integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Catálogo público para cualquier cuenta autenticada.
CREATE POLICY subjects_select ON public.subjects
  FOR SELECT TO authenticated
  USING (is_active OR public.is_admin());

CREATE POLICY subjects_write ON public.subjects
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY subjects_update ON public.subjects
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY subjects_delete ON public.subjects
  FOR DELETE TO authenticated USING (public.is_admin());


-- ────────────────────────────────────────────────────────────
--  2.3 sessions — sesiones de clase (estado en tiempo real)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid        NOT NULL REFERENCES public.children (id) ON DELETE CASCADE,
  educator_id uuid                 REFERENCES public.users (id) ON DELETE SET NULL,
  subject_id  uuid                 REFERENCES public.subjects (id) ON DELETE SET NULL,
  status      text        NOT NULL DEFAULT 'planificada'
                          CHECK (status IN ('planificada', 'en_curso', 'en_recreo', 'completada', 'cancelada')),
  started_at  timestamptz,
  ended_at    timestamptz,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sessions_fechas_coherentes CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

--  ⚠️ NO se incluye aquí ninguna credencial de streaming.
--  RLS restringe FILAS, no columnas: si la familia puede leer la sesión, podría
--  leer cualquier secreto guardado en ella. Las claves de video irán en una
--  relación propia de acceso restringido + una Edge Function que entregue URLs
--  firmadas de corta duración (ADR-007, Fase B).

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_select ON public.sessions
  FOR SELECT TO authenticated
  USING (public.can_view_child(child_id));

CREATE POLICY sessions_insert ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_educator());

CREATE POLICY sessions_update ON public.sessions
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_educator())
  WITH CHECK (public.is_admin() OR public.is_educator());

CREATE POLICY sessions_delete ON public.sessions
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ────────────────────────────────────────────────────────────
--  2.4 progress — registro de progreso por competencia
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.progress (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid        NOT NULL REFERENCES public.children (id) ON DELETE CASCADE,
  session_id  uuid                 REFERENCES public.sessions (id) ON DELETE SET NULL,
  educator_id uuid                 REFERENCES public.users (id) ON DELETE SET NULL,
  competency  text        NOT NULL
                          CHECK (competency IN ('autonomia', 'atencion', 'organizacion', 'comunicacion', 'aprendizaje')),
  score       integer     NOT NULL CHECK (score BETWEEN 0 AND 100),
  notes       text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY progress_select ON public.progress
  FOR SELECT TO authenticated
  USING (public.can_view_child(child_id));

-- Solo escribe quien registra el progreso: educador o admin. La familia lee.
CREATE POLICY progress_insert ON public.progress
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_educator());

CREATE POLICY progress_update ON public.progress
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_educator())
  WITH CHECK (public.is_admin() OR public.is_educator());

CREATE POLICY progress_delete ON public.progress
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ────────────────────────────────────────────────────────────
--  2.5 resources — biblioteca de recursos
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.resources (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text        NOT NULL
                            CHECK (category IN ('lectura', 'escritura', 'matematicas', 'atencion', 'lenguaje', 'creatividad')),
  title         text        NOT NULL,
  description   text,
  url           text,
  file_path     text,
  kind          text        NOT NULL DEFAULT 'documento'
                            CHECK (kind IN ('documento', 'video', 'audio', 'actividad', 'enlace')),
  age_min       integer              CHECK (age_min IS NULL OR age_min BETWEEN 0 AND 18),
  age_max       integer              CHECK (age_max IS NULL OR age_max BETWEEN 0 AND 18),
  is_downloadable boolean   NOT NULL DEFAULT false,
  is_published  boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT resources_edades_coherentes CHECK (age_min IS NULL OR age_max IS NULL OR age_max >= age_min)
);

COMMENT ON COLUMN public.resources.file_path IS 'Ruta en Storage. La descarga se hace con URL firmada, nunca con bucket público.';

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY resources_select ON public.resources
  FOR SELECT TO authenticated
  USING (is_published OR public.is_admin());

CREATE POLICY resources_insert ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_educator());

CREATE POLICY resources_update ON public.resources
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_educator())
  WITH CHECK (public.is_admin() OR public.is_educator());

CREATE POLICY resources_delete ON public.resources
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ────────────────────────────────────────────────────────────
--  2.6 articles — Academia para Padres
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.articles (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text        NOT NULL,
  slug            text        NOT NULL UNIQUE,
  excerpt         text,
  content         text        NOT NULL DEFAULT '',
  cover_url       text,
  topic           text        NOT NULL DEFAULT 'desarrollo'
                              CHECK (topic IN ('rutinas', 'limites', 'regulacion_emocional', 'desarrollo')),
  reading_minutes integer     NOT NULL DEFAULT 3 CHECK (reading_minutes > 0),
  is_published    boolean     NOT NULL DEFAULT false,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY articles_select ON public.articles
  FOR SELECT TO authenticated
  USING (is_published OR public.is_admin());

CREATE POLICY articles_insert ON public.articles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY articles_update ON public.articles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY articles_delete ON public.articles
  FOR DELETE TO authenticated USING (public.is_admin());


-- ────────────────────────────────────────────────────────────
--  2.7 notes — mensajes del educador a la familia
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid        NOT NULL REFERENCES public.children (id) ON DELETE CASCADE,
  educator_id uuid        NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  message     text        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notes_select ON public.notes
  FOR SELECT TO authenticated
  USING (public.can_view_child(child_id));

CREATE POLICY notes_insert ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin() OR public.is_educator()) AND educator_id = auth.uid());

-- La familia solo puede marcar como leída; el contenido lo edita su autor.
CREATE POLICY notes_update ON public.notes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR educator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.parent_id = auth.uid())
  )
  WITH CHECK (public.is_admin() OR educator_id = auth.uid());

CREATE POLICY notes_delete ON public.notes
  FOR DELETE TO authenticated
  USING (public.is_admin() OR educator_id = auth.uid());


-- ────────────────────────────────────────────────────────────
--  2.8 payments — plan y estado de pagos
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.payments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    uuid        NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  plan_name    text        NOT NULL DEFAULT 'mensual',
  amount       numeric(10,2) NOT NULL CHECK (amount >= 0),
  currency     text        NOT NULL DEFAULT 'CLP',
  status       text        NOT NULL DEFAULT 'pendiente'
                           CHECK (status IN ('pendiente', 'pagado', 'vencido', 'reembolsado', 'cancelado')),
  period_start date,
  period_end   date,
  invoice_url  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payments_periodo_coherente CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- La familia ve SUS pagos; nadie ve los de otra familia.
CREATE POLICY payments_select ON public.payments
  FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR public.is_admin());

-- Escribir datos de pago es exclusivo del administrador (o de una integración
-- server-side con service_role, que sortea RLS).
CREATE POLICY payments_insert ON public.payments
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY payments_update ON public.payments
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY payments_delete ON public.payments
  FOR DELETE TO authenticated USING (public.is_admin());


-- ────────────────────────────────────────────────────────────
--  2.9 documents — informes y documentos
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.documents (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid                 REFERENCES public.children (id) ON DELETE CASCADE,
  parent_id   uuid                 REFERENCES public.users (id) ON DELETE CASCADE,
  title       text        NOT NULL,
  file_path   text        NOT NULL,
  kind        text        NOT NULL DEFAULT 'informe'
                          CHECK (kind IN ('informe', 'certificado', 'contrato', 'otro')),
  uploaded_by uuid                 REFERENCES public.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT documents_destino_obligatorio CHECK (child_id IS NOT NULL OR parent_id IS NOT NULL)
);

COMMENT ON COLUMN public.documents.file_path IS 'Ruta en Storage. Siempre se sirve con URL firmada de corta duración.';

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_select ON public.documents
  FOR SELECT TO authenticated
  USING (
    parent_id = auth.uid()
    OR public.is_admin()
    OR (child_id IS NOT NULL AND public.can_view_child(child_id))
  );

CREATE POLICY documents_insert ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_educator());

CREATE POLICY documents_update ON public.documents
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_educator())
  WITH CHECK (public.is_admin() OR public.is_educator());

CREATE POLICY documents_delete ON public.documents
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================
--  SECCIÓN 3 · TRIGGERS DE updated_at E ÍNDICES
-- ============================================================

DROP TRIGGER IF EXISTS children_set_updated_at  ON public.children;
DROP TRIGGER IF EXISTS subjects_set_updated_at  ON public.subjects;
DROP TRIGGER IF EXISTS sessions_set_updated_at  ON public.sessions;
DROP TRIGGER IF EXISTS progress_set_updated_at  ON public.progress;
DROP TRIGGER IF EXISTS resources_set_updated_at ON public.resources;
DROP TRIGGER IF EXISTS articles_set_updated_at  ON public.articles;
DROP TRIGGER IF EXISTS notes_set_updated_at     ON public.notes;
DROP TRIGGER IF EXISTS payments_set_updated_at  ON public.payments;
DROP TRIGGER IF EXISTS documents_set_updated_at ON public.documents;

CREATE TRIGGER children_set_updated_at  BEFORE UPDATE ON public.children  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER subjects_set_updated_at  BEFORE UPDATE ON public.subjects  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sessions_set_updated_at  BEFORE UPDATE ON public.sessions  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER progress_set_updated_at  BEFORE UPDATE ON public.progress  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER resources_set_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER articles_set_updated_at  BEFORE UPDATE ON public.articles  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER notes_set_updated_at     BEFORE UPDATE ON public.notes     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payments_set_updated_at  BEFORE UPDATE ON public.payments  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Índices para las consultas reales de la aplicación.
CREATE INDEX IF NOT EXISTS children_parent_idx     ON public.children  (parent_id);
CREATE INDEX IF NOT EXISTS children_educator_idx   ON public.children  (educator_id);
CREATE INDEX IF NOT EXISTS children_sala_idx       ON public.children  (sala) WHERE sala IS NOT NULL;

CREATE INDEX IF NOT EXISTS sessions_child_date_idx ON public.sessions  (child_id, started_at DESC);
CREATE INDEX IF NOT EXISTS sessions_status_idx     ON public.sessions  (status) WHERE status IN ('en_curso', 'en_recreo');
CREATE INDEX IF NOT EXISTS sessions_educator_idx   ON public.sessions  (educator_id);

CREATE INDEX IF NOT EXISTS progress_child_idx      ON public.progress  (child_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS progress_competency_idx ON public.progress  (child_id, competency, recorded_at DESC);

CREATE INDEX IF NOT EXISTS resources_category_idx  ON public.resources (category) WHERE is_published;
CREATE INDEX IF NOT EXISTS articles_topic_idx      ON public.articles  (topic) WHERE is_published;
CREATE INDEX IF NOT EXISTS articles_slug_idx       ON public.articles  (slug);

CREATE INDEX IF NOT EXISTS notes_child_idx         ON public.notes     (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notes_unread_idx        ON public.notes     (child_id) WHERE NOT is_read;

CREATE INDEX IF NOT EXISTS payments_parent_idx     ON public.payments  (parent_id, period_end DESC);
CREATE INDEX IF NOT EXISTS documents_child_idx     ON public.documents (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS documents_parent_idx    ON public.documents (parent_id, created_at DESC);


-- ============================================================
--  SECCIÓN 4 · REALTIME
-- ============================================================
--  Solo las tablas que la UI necesita ver cambiar en vivo. Publicar las demás
--  (payments, documents) ampliaría la superficie de exposición sin beneficio.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'progress'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.progress;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
  END IF;
END
$$;

-- `REPLICA IDENTITY FULL` hace que los eventos de Realtime incluyan la fila
-- anterior en UPDATE y DELETE. Sin esto, `postgres_changes` entrega OLD vacío.
ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER TABLE public.progress REPLICA IDENTITY FULL;
ALTER TABLE public.notes    REPLICA IDENTITY FULL;


-- ============================================================
--  SECCIÓN 5 · DATOS SEMILLA
-- ============================================================

INSERT INTO public.subjects (name, category, icon, color, order_index) VALUES
  ('Lectura',       'lectura',       '📖', 'primary',  1),
  ('Escritura',     'escritura',     '✏️', 'navy',     2),
  ('Matemáticas',   'matematicas',   '🔢', 'sun',      3),
  ('Atención',      'atencion',      '🎯', 'coral',    4),
  ('Lenguaje',      'lenguaje',      '💬', 'creative', 5),
  ('Creatividad',   'creatividad',   '🎨', 'success',  6)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.articles (title, slug, excerpt, content, topic, reading_minutes, is_published, published_at) VALUES
  (
    'Rutinas diarias que funcionan',
    'rutinas-diarias-que-funcionan',
    'Cómo construir una rutina predecible que reduzca las peleas de la mañana y de la noche.',
    'Una rutina predecible baja la ansiedad infantil porque el niño sabe qué viene después. Empieza por anclar tres momentos: despertar, comida y dormir. Mantén el mismo orden aunque cambie la hora. Anticipa las transiciones con avisos de cinco minutos.',
    'rutinas', 4, true, now()
  ),
  (
    'Límites claros, vínculos seguros',
    'limites-claros-vinculos-seguros',
    'Poner límites no rompe el vínculo: lo sostiene. Guía práctica para decir que no sin gritar.',
    'Un límite funciona cuando es breve, concreto y constante. Nombra la emoción, sostiene la regla y ofrece una alternativa aceptable. Evita negociar la regla en pleno desborde: se conversa después, en calma.',
    'limites', 5, true, now()
  ),
  (
    'Acompañar la regulación emocional',
    'acompanar-la-regulacion-emocional',
    'Qué hacer durante un desborde y qué hacer después, explicado por etapas.',
    'Durante el desborde el cerebro racional está fuera de línea: no sirve explicar ni sermonear. Primero seguridad, después presencia calmada, y solo al final palabras. Nombrar la emoción ayuda a integrarla.',
    'regulacion_emocional', 6, true, now()
  ),
  (
    'Hitos del desarrollo entre 4 y 10 años',
    'hitos-del-desarrollo-4-a-10-anos',
    'Qué esperar en autonomía, atención, organización, comunicación y aprendizaje.',
    'El desarrollo no es lineal ni uniforme: cada competencia madura a su ritmo. Observa tendencias de varias semanas, no días sueltos. Si una competencia retrocede de forma sostenida, consúltalo con el educador.',
    'desarrollo', 7, true, now()
  )
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
--  SECCIÓN 6 · PROMOCIÓN DEL PRIMER ADMINISTRADOR
-- ============================================================
--  Sustituye el email por el tuyo y ejecuta ESTE BLOQUE POR SEPARADO,
--  después de haber creado tu cuenta en la app (o con signUp desde el panel
--  de Auth de Supabase).
--
--  El email se compara normalizado: lower(trim(...)).

-- UPDATE public.users
--    SET role = 'admin',
--        sala = NULL
--  WHERE email = lower(trim('TU_EMAIL@ejemplo.com'));

-- Verificación:
-- SELECT id, email, full_name, role, sala FROM public.users WHERE role = 'admin';


-- ============================================================
--  SECCIÓN 7 · VERIFICACIÓN
-- ============================================================
--  Ejecuta estas consultas por separado para confirmar el resultado.

-- 7.1 Las 10 tablas existen y tienen RLS activado.
-- SELECT c.relname AS tabla,
--        c.relrowsecurity  AS rls_activado,
--        c.relforcerowsecurity AS rls_forzado
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public'
--    AND c.relname IN ('users','children','subjects','sessions','progress',
--                      'resources','articles','notes','payments','documents')
--  ORDER BY c.relname;

-- 7.2 Políticas creadas por tabla.
-- SELECT tablename, policyname, cmd, roles
--   FROM pg_policies
--  WHERE schemaname = 'public'
--  ORDER BY tablename, policyname;

-- 7.3 Triggers instalados.
-- SELECT event_object_table AS tabla, trigger_name, action_timing, event_manipulation
--   FROM information_schema.triggers
--  WHERE trigger_schema IN ('public','auth')
--  ORDER BY event_object_table, trigger_name;

-- 7.4 Tablas publicadas en Realtime.
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- 7.5 Ninguna tabla del proyecto se llama `profiles` (Regla 1).
-- SELECT count(*) AS tablas_llamadas_profiles
--   FROM information_schema.tables
--  WHERE table_schema = 'public' AND table_name = 'profiles';
