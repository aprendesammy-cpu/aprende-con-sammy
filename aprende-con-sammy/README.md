# 🐼 Aprende con Sammy

Plataforma educativa que conecta **padres**, **educadores** y **niños** en un ecosistema de
aprendizaje integral: progreso en tiempo real, cámara del aula, biblioteca de recursos y
perfil de familia.

> 📐 Aplicación **web mobile-first** (se siente nativa en el teléfono y funciona en el
> navegador del centro educativo). Ver [`DOCS/decisiones-arquitectura.md`](DOCS/decisiones-arquitectura.md).

## Stack

| Capa         | Tecnología                                              |
| ------------ | ------------------------------------------------------- |
| Build tool   | Vite 8                                                  |
| UI           | React 19 + TypeScript 5.9 (modo estricto)               |
| Estilos      | Tailwind CSS v4 (`@tailwindcss/vite`, sin `tailwind.config.js`) |
| Enrutamiento | React Router DOM v7                                     |
| Backend      | Supabase (Auth + PostgreSQL + RLS + Realtime + Storage)  |
| Tests        | Node test runner + `tsx`, Vitest 5 + jsdom + Testing Library |
| Despliegue   | Vercel (Framework Preset: **Vite**, Output: `dist`)      |

## Reglas no negociables

1. La tabla de la base de datos se llama **siempre `users`** — **nunca `profiles`**.
2. Las variables de entorno usan **siempre** el prefijo **`VITE_`** y se leen con
   `import.meta.env` (nunca `NEXT_PUBLIC_` ni `process.env`).
3. El email se **normaliza siempre** antes de cualquier operación:
   `const normalizedEmail = email.toLowerCase().trim();`
4. Todas las funciones usan `try/catch` y validan el `error` devuelto por Supabase.
5. Sin `console.log` de debug; solo `console.error` para fallos reales.
6. TypeScript estricto con interfaces bien definidas en `src/types/index.ts`.

## Roles

```ts
type UserRole = 'padre' | 'educador' | 'admin'
```

`admin` **no** puede crearse por registro público (está excluido a nivel de tipos con
`PublicRegisterRole = Exclude<UserRole, 'admin'>`): se asigna solo por SQL o desde la
pantalla de Gestión de Usuarios.

## 🚀 Puesta en marcha

**La guía paso a paso completa está en [`DOCS/GUIA-DE-SETUP.md`](DOCS/GUIA-DE-SETUP.md):**
instalación de herramientas (Node 22, Git, GitHub CLI, Supabase CLI, Vercel CLI) en
macOS / Windows / Linux, creación del proyecto Supabase, ejecución del SQL, Auth,
Edge Function, repo en GitHub, despliegue en Vercel, checklist de verificación y
troubleshooting.

Resumen mínimo:

```bash
# 1. Base de datos
#    Supabase → SQL Editor → pegar el contenido de supabase/schema.sql → Run
#    Auth → URL Configuration → Site URL = tu dominio de Vercel

# 2. Entorno local
cp .env.example .env.local      # y pega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# 3. Edge Function (necesaria para «Crear Usuario Manualmente»)
supabase link --project-ref TU_PROJECT_REF
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role>
supabase functions deploy admin-create-user

# 4. Promover al primer administrador (SQL Editor)
UPDATE public.users SET role='admin', sala=NULL
 WHERE email = lower(trim('tu@email.com'));

# 5. Vercel: Framework Preset = Vite · Output = dist · Node 22.x
#    Environment Variables (tipo Config, en Production/Preview/Development):
#      VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY
```

## Puesta en marcha local

```bash
# 1. Requisitos: Node >= 22.12.0 (ver ADR-008: supabase-js necesita WebSocket nativo)
nvm use        # lee .nvmrc → 22.23.3
node -v

# 2. Instalar dependencias
npm install

# 3. Crear tu entorno local (NUNCA se sube a Git)
cp .env.example .env.local
#    → edita .env.local con tu VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# 4. Servidor de desarrollo
npm run dev

# 5. Verificación completa
npm run test         # 124 pruebas: 16 unitarias + 16 integración + 92 de UI
npm run test:unit    # validaciones y normalización (node:test + tsx)
npm run test:auth    # integración contra un Supabase simulado (esbuild + node)
npm run test:ui      # componentes con Vitest + jsdom + Testing Library
npm run lint        # oxlint — 0 warnings, 0 errors
npm run build        # tsc -b (type-check estricto) + vite build
npm run check:schema # 17 invariantes del SQL sobre el AST (requiere pglast)
npm run check:styles # comprueba que todo token propio genera CSS
npm run verify       # todo lo anterior en cadena
npm run preview      # previsualizar el build de producción
```

## Estructura

```
aprende-con-sammy/
├── .env.example                     # Plantilla de variables (prefijo VITE_)
├── DOCS/
│   ├── analisis-de-choque.md        # Especificación de producto vs. reglas estrictas
│   └── decisiones-arquitectura.md   # ADR-001 … ADR-007 (vinculantes)
├── index.html                       # lang="es", meta y favicon
├── public/favicon.svg               # Identidad Sammy
├── scripts/
│   └── check-tailwind-tokens.py     # Detecta tokens de Tailwind que no generan CSS
├── supabase/
│   ├── schema.sql                   # ⭐ Script SQL maestro (Paso 6)
│   └── functions/admin-create-user/ # ⭐ Edge Function con service_role (ADR-009)
├── scripts/
│   ├── check-schema.py              # Valida el SQL con libpg_query (17 invariantes)
│   └── check-tailwind-tokens.py     # Detecta tokens que no generan CSS
├── .github/workflows/ci.yml         # CI: lint + 124 tests + build + esquema
├── vercel.json                      # Preset Vite, reescritura SPA y cabeceras
├── vitest.config.ts                 # Vitest (jsdom) para pruebas de componentes
├── tests/
│   ├── utils.test.ts                # Normalización y validaciones (Regla 3)
│   ├── supabase-config.test.ts      # Fallo accionable sin variables de entorno
│   ├── mockSupabase.ts              # Supabase simulado (GoTrue + PostgREST)
│   ├── authSmoke.ts                 # Ejecución del flujo de auth
│   ├── authSmokeEntry.ts            # Entry point empaquetado por esbuild
│   ├── run-auth-smoke.mts           # Runner: inyecta import.meta.env y verifica
│   └── components/
│       ├── setup.ts                 # jest-dom + jsdom + cleanup
│       ├── ui.test.tsx              # Button, Input, Select, ProgressBar, Alert, Badge
│       ├── RegisterForm.test.tsx    # Campo condicional "Sala", validación, envío
│       ├── LoginForm.test.tsx       # Validación, normalización, recuperación
│       └── ProtectedRoute.test.tsx  # Los 6 estados de la guarda
├── vite.config.ts                   # react + tailwindcss + alias "@" → ./src
├── tsconfig.app.json                # TS ESTRICTO + paths
└── src/
    ├── main.tsx                     # Bootstrap de React
    ├── App.tsx                      # Pantalla temporal (se reemplaza en el Paso 5)
    ├── index.css                    # Tailwind v4 + @theme (paleta oficial del producto)
    ├── vite-env.d.ts                # Tipado fuerte de ImportMetaEnv
    ├── components/
    │   ├── AuthPageShell.tsx        # Envoltorio de marca para login/registro
    │   ├── CreateUserDialog.tsx     # Alta manual (<dialog> nativo)
    │   ├── UsersTable.tsx           # Tabla (escritorio) + tarjetas (móvil)
    │   ├── icons.tsx                # 18 iconos SVG propios (sin dependencias)
    │   ├── SammyMascot.tsx          # ⭐ Mascota en 3 poses + SammyMark
    │   ├── Layout.tsx               # ⭐ Topbar + sidebar (md) + bottom nav (móvil)
    │   ├── ProtectedRoute.tsx       # ⭐ Guardia de sesión y de rol
    │   ├── RegisterForm.tsx         # ⭐ Alta con campo condicional "Sala"
    │   ├── LoginForm.tsx            # ⭐ Acceso + recuperación integrada
    │   └── ui/                      # Button, Card, Input, Select, ProgressBar,
    │                                #   Badge, Alert, Spinner (+ barril index.ts)
    ├── pages/
    │   ├── LoginPage.tsx · RegisterPage.tsx
    │   ├── Dashboard.tsx            # Saludo + rol + acceso a administración
    │   ├── AdminUsers.tsx           # Gestión de Usuarios (solo admin)
    │   ├── CameraPage.tsx · ProgressPage.tsx · ResourcesPage.tsx · FamilyPage.tsx
    │   └── NotFoundPage.tsx
    ├── hooks/useAuth.tsx            # ⭐ AuthProvider + useAuth/useAuthState
    ├── types/index.ts               # ⭐ Contrato de tipos del dominio
    └── lib/
        ├── supabase.ts              # ⭐ Cliente singleton + validación de entorno
        ├── auth.ts                  # ⭐ registerUser, loginUser, logoutUser, …
        ├── users.ts                 # listUsers, createUserManually, updateUserRole…
        ├── navigation.ts            # Lectura segura de location.state, saludo
        ├── validation.ts            # Validación de formularios campo a campo
        └── utils.ts                 # normalizeEmail, isValidEmail, …
```

## Paleta oficial

| Rol visual | Token | Color |
| --- | --- | --- |
| Primario (botones, acentos, activo) | `primary-400` | `#2DD4BF` |
| Títulos y encabezados | `navy-700` | `#1E3A8A` |
| Destacados y advertencias | `sun-400` | `#FBBF24` |
| Acentos terciarios | `coral-500` | `#F97316` |
| Elementos creativos | `creative-500` | `#8B5CF6` |
| Éxito y progreso | `success-500` | `#10B981` |
| Errores | `danger-500` | `#EF4444` |
| Fondo | `cream` | `#F9FAFB` |
| Texto | `ink` / `muted` | `#1F2937` / `#6B7280` |

## Documentación

| Documento | Contenido |
| --- | --- |
| [`DOCS/GUIA-DE-SETUP.md`](DOCS/GUIA-DE-SETUP.md) | **Guía completa**: herramientas, Supabase, GitHub, Vercel, troubleshooting |
| [`DOCS/decisiones-arquitectura.md`](DOCS/decisiones-arquitectura.md) | ADR-001 … ADR-013 (vinculantes) |
| [`DOCS/analisis-de-choque.md`](DOCS/analisis-de-choque.md) | Especificación de producto vs. reglas estrictas |
| [`supabase/schema.sql`](supabase/schema.sql) | Script SQL maestro comentado |

## Roadmap

- [x] **Paso 1** — Configuración inicial y tipos
- [x] **Paso 2** — Cliente Supabase y lógica de auth (`registerUser` con upsert defensivo,
      `loginUser`, `logoutUser`, `getCurrentUser`, `getUserProfile`, `resetPassword`)
- [x] **Paso 3** — Estado global (`src/hooks/useAuth.tsx` + pruebas de integración)
- [x] **Paso 4** — Sistema de diseño, Layout, ProtectedRoute y formularios
- [x] **Paso 5** — Páginas, enrutamiento, panel de administración y Edge Function
- [ ] **Paso 6** — Script SQL maestro (10 tablas + RLS + triggers)
- [ ] **Paso 7** — Despliegue en Vercel

### Cómo funcionan las pruebas de integración

`@supabase/supabase-js` lee `import.meta.env`, que solo existe dentro del bundler de Vite.
`tests/run-auth-smoke.mts` arranca un **mock local de Supabase** (GoTrue + PostgREST, con
`Accept: application/vnd.pgrst.object+json`, `406 PGRST116`, `422 User already registered`
y `403` por RLS), empaqueta el entry point con **esbuild** inyectando esas variables, lo
ejecuta en un proceso hijo y luego **verifica las peticiones HTTP reales** que el cliente
envió. Así se prueba el protocolo, no una imitación.

**Bundle (ADR-010):** 21 chunks con `React.lazy` por ruta y `advancedChunks.groups`.
Antes había un único chunk de 503 kB; ahora `react` (218 kB), `supabase` (204 kB) y
`router` (38 kB) se cachean por separado y cada página pesa entre 1 y 16 kB.

**Fase B:** tabla `children` poblada, Realtime (estado de sesión y notas en vivo),
streaming HLS con URL firmada, gráficos de tendencia, Storage y descargas, pagos,
Web Push + PWA instalable y acceso offline.

**Fase C:** módulo educador completo, chat y videoconferencia padre–educador,
gamificación con recompensas, reportes PDF, IA de recomendaciones, i18n (EN/PT) y,
opcionalmente, app nativa Expo reutilizando el mismo backend (ADR-001).

## Privacidad de menores (ADR-007)

Los datos de menores viven **solo** en `children`, nunca en `auth.users` ni en metadatos
del JWT. Un `padre` únicamente lee `children` donde `parent_id = auth.uid()` (RLS). Las
URLs de streaming y documentos se entregan firmadas y con expiración corta.
