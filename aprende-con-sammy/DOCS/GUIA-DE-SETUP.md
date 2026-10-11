# 🛠️ Guía completa de setup — Aprende con Sammy

De cero a producción: herramientas, base de datos, GitHub y Vercel.

**Tiempo estimado:** 45–60 minutos la primera vez.

| Parte | Qué configuras | Tiempo |
|---|---|---|
| [0](#parte-0--herramientas) | Herramientas locales | 15 min |
| [1](#parte-1--base-de-datos-supabase) | Supabase: proyecto, SQL, Auth, Edge Function | 20 min |
| [2](#parte-2--desarrollo-local) | Desarrollo local | 3 min |
| [3](#parte-3--github) | Repositorio en GitHub | 5 min |
| [4](#parte-4--vercel) | Despliegue en Vercel | 10 min |
| [5](#parte-5--verificación-post-despliegue) | Checklist de verificación | 5 min |
| [6](#parte-6--troubleshooting) | Troubleshooting | — |
| [7](#parte-7--mantenimiento) | Mantenimiento | — |

> En todos los ejemplos se asume macOS/Linux. En Windows (PowerShell) las
> diferencias están indicadas explícitamente.

---

## Parte 0 · Herramientas

### 0.1 Resumen de lo que necesitas

| Herramienta | Versión mínima | ¿Obligatoria? | Para qué |
|---|---|---|---|
| **Node.js** | **22.12.0** | ✅ Sí | Runtime. Ver [ADR-008](decisiones-arquitectura.md) |
| **npm** | 10.x | ✅ Sí | Viene con Node |
| **Git** | 2.30+ | ✅ Sí | Control de versiones |
| **GitHub CLI** (`gh`) | 2.x | Recomendada | Crear el repo y el push sin salir de la terminal |
| **Supabase CLI** | 1.200+ | Recomendada | Desplegar la Edge Function y migraciones |
| **Vercel CLI** | 33+ | Opcional | Desplegar desde la terminal (la alternativa es el dashboard) |
| **VS Code** | — | Opcional | Editor |

> ⚠️ **Node 22 no es negociable.** `@supabase/supabase-js` instancia el cliente
> Realtime de forma ansiosa y Node 20 no tiene `WebSocket` global: `createClient()`
> lanza `Node.js 20 detected without native WebSocket support`. En el navegador no
> ocurre, pero sí en tests, SSR y scripts de CI.

### 0.2 macOS

```bash
# Homebrew (si no lo tienes)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node 22 LTS
brew install node@22
brew link --overwrite node@22

# Git ya viene con Xcode Command Line Tools
xcode-select --install

# CLIs
brew install gh supabase/tap/supabase vercel

# Verificación
node -v    # v22.x.x
npm -v
git --version
gh --version
supabase --version
```

Si prefieres gestionar varias versiones de Node, usa **nvm** (el proyecto incluye `.nvmrc`):

```bash
brew install nvm
mkdir -p ~/.nvm
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
source ~/.zshrc

cd aprende-con-sammy
nvm install     # lee .nvmrc → 22.23.3
nvm use
```

### 0.3 Windows (PowerShell 7+)

```powershell
# Gestor de paquetes
winget install --id Microsoft.WinGet -e

# Node 22 LTS
winget install --id OpenJS.NodeJS.LTS -e

# Git
winget install --id Git.Git -e

# GitHub CLI
winget install --id GitHub.cli -e

# Supabase CLI (requiere Scoop)
winget install --id Scoop.Scoop -e
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Vercel CLI
npm install -g vercel

# Cierra y reabre la terminal, luego verifica
node -v ; npm -v ; git --version ; gh --version
```

### 0.4 Linux (Debian/Ubuntu)

```bash
# Node 22 desde NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Git
sudo apt-get install -y git

# GitHub CLI
sudo apt-get install -y gh

# Supabase CLI
sudo npm install -g supabase --unsafe-perm

# Vercel CLI
sudo npm install -g vercel
```

### 0.5 Extensiones de VS Code (opcional pero recomendado)

| Extensión | ID | Para qué |
|---|---|---|
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Autocompletado de las clases y tokens `sammy` |
| ESLint / oxlint | `oxc.oxc-vscode` | Los mismos avisos que `npm run lint` |
| Prettier | `esbenp.prettier-vscode` | Formateo |
| Error Lens | `usernamehw.errorlens` | Errores de TS en línea |
| Supabase | `supabase.vscode-supabase` | Autocompletado SQL y gestión del proyecto |
| DotENV | `mikestead.dotenv` | Resaltado de `.env.local` |

Añade `tailwindcss.experimental.configFile` **no** hace falta: Tailwind v4 se
configura en CSS. Asegúrate de que la extensión apunte a `src/index.css`.

### 0.6 Clonar y arrancar el proyecto

```bash
git clone <URL_DE_TU_REPO> aprende-con-sammy
cd aprende-con-sammy
nvm use            # o verifica: node -v >= 22.12.0
npm ci             # instalación reproducible desde package-lock.json
```

---

## Parte 1 · Base de datos (Supabase)

### 1.1 Crear el proyecto

1. Entra en <https://supabase.com> → **Sign in** (puedes usar tu cuenta de GitHub).
2. **New project**.
3. Rellena:
   - **Name:** `aprende-con-sammy`
   - **Database Password:** genera una fuerte y **guárdala en un gestor de contraseñas**. No va en el código.
   - **Region:** la más cercana a tus usuarios (para Chile: `South America (São Paulo)` o `US East`).
   - **Pricing Plan:** Free es suficiente para desarrollar.
4. **Create new project** y espera ~2 minutos al aprovisionamiento.

### 1.2 Anotar las credenciales

Ve a **Project Settings** (⚙️) → **API Keys** (en proyectos nuevos: **Data API** / **API Keys**).

| Dato | Dónde está | Se usa como |
|---|---|---|
| **Project URL** | Settings → General, o Data API | `VITE_SUPABASE_URL` |
| **anon / public key** | Settings → API Keys → `anon` `public` | `VITE_SUPABASE_ANON_KEY` |
| **service_role key** | Settings → API Keys → `service_role` (oculta tras "Reveal") | ⚠️ **SOLO** secreto de la Edge Function. **NUNCA** en el frontend ni en Git |

> 🔐 La `anon key` **es pública por diseño**: viaja en el bundle del navegador.
> La seguridad real la dan las políticas RLS del Paso 6, no el secretismo de esa clave.
>
> 🚨 La `service_role` **ignora todas las RLS**. Si llega a Git o al bundle,
> cualquiera puede leer, modificar o borrar todos los datos de la plataforma,
> incluidos los de menores. Trátala como la contraseña de root.

### 1.3 Configurar Auth

**Authentication** → **Providers** → **Email**:

- **Enable Email provider:** ✅ activado
- **Confirm email:** decisión importante —

| Opción | Efecto | Recomendado para |
|---|---|---|
| **Activada** | El usuario recibe un enlace y no puede entrar hasta confirmarlo. `registerUser()` devuelve `requiresConfirmation: true` y la app muestra el panel «¡Casi listo!» | **Producción** |
| **Desactivada** | La sesión se crea de inmediato | Desarrollo y pruebas |

> La aplicación maneja **ambos** casos. No tienes que cambiar código.

Opcional pero recomendado en producción:
- **Authentication → URL Configuration → Site URL:** `https://tu-proyecto.vercel.app`
- **Redirect URLs:** añade `http://localhost:5173/**` y la URL de preview de Vercel
  (`https://*.vercel.app/**`). Sin esto, los enlaces de confirmación y de
  recuperación de contraseña apuntan a un dominio equivocado.

### 1.4 Ejecutar el script SQL maestro

1. **SQL Editor** (icono `</>` en la barra lateral) → **New query**.
2. Abre el archivo [`supabase/schema.sql`](../supabase/schema.sql) y **copia todo su contenido**.
3. Pégalo en el editor y pulsa **Run** (⌘/Ctrl + Enter).

> ⚠️ El script empieza con `DROP TABLE`. Es seguro en un proyecto nuevo, pero
> **destruye los datos** si lo re-ejecutas en producción.

Deberías ver `Success. No rows returned`.

**Qué crea el script:**

| Sección | Contenido |
|---|---|
| 0 | 9 funciones auxiliares (`is_admin`, `current_role`, `can_view_child`, …) |
| 1 | `public.users` + normalización de email + 2 triggers + 4 políticas RLS |
| 2 | 9 tablas del dominio con sus 36 políticas RLS |
| 3 | 9 triggers de `updated_at` + 18 índices |
| 4 | Publicación de `sessions`, `progress` y `notes` en Realtime |
| 5 | Semillas: 6 materias y 4 artículos de la Academia para Padres |
| 6 | Bloque comentado para promover al primer admin |
| 7 | Consultas de verificación |

### 1.5 Verificar que el esquema quedó bien

En el **SQL Editor**, ejecuta una a una las consultas de la Sección 7 del script.
Las tres primeras deben devolver:

```sql
-- 7.1  → 10 filas, todas con rls_activado = true
-- 7.2  → 40 filas (4 políticas por tabla)
-- 7.5  → tablas_llamadas_profiles = 0
```

O, más rápido, valida el archivo localmente sin tocar la base de datos:

```bash
pip install pglast          # parser real de PostgreSQL
npm run check:schema        # 17 invariantes sobre el AST
```

### 1.6 Crear tu cuenta y promoverla a admin

**Opción A — desde la app (recomendada):**

```bash
cp .env.example .env.local
# edita .env.local con tu URL y tu anon key
npm run dev
```

Abre <http://localhost:5173/register>, crea tu cuenta con rol **Padre** o
**Educador**, y confirma el email si tenías esa opción activada.

**Opción B — desde el panel de Supabase:**
**Authentication** → **Users** → **Add user** → *Create new user*. Marca
**Auto Confirm User** y rellena email y contraseña. El trigger
`handle_new_auth_user` crea la fila en `public.users` automáticamente.

**Después, en ambos casos**, promuévete a admin en el **SQL Editor**:

```sql
UPDATE public.users
   SET role = 'admin',
       sala = NULL
 WHERE email = lower(trim('TU_EMAIL@ejemplo.com'));

-- Comprueba que funcionó:
SELECT id, email, full_name, role, sala FROM public.users WHERE role = 'admin';
```

> El `sala = NULL` es obligatorio: la restricción `users_sala_solo_educador`
> impide que un rol distinto de `educador` tenga sala asignada.

### 1.7 Desplegar la Edge Function (alta manual de usuarios)

Necesaria para que funcione el botón **«Crear Usuario Manualmente»** del panel
de administración. Ver [ADR-009](decisiones-arquitectura.md).

```bash
# 1. Iniciar sesión
supabase login

# 2. Vincular el proyecto local con el remoto
cd aprende-con-sammy
supabase link --project-ref TU_PROJECT_REF
#    (el project ref es el subdominio: https://TU_PROJECT_REF.supabase.co)

# 3. Guardar el secreto service_role (NO va en Git)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# 4. Desplegar
supabase functions deploy admin-create-user

# 5. Comprobar
supabase functions list
```

`SUPABASE_URL` y `SUPABASE_ANON_KEY` ya están definidas por Supabase en el
entorno de la función; no hace falta configurarlas.

**Prueba rápida desde la terminal** (debe responder `401`, porque no envías token):

```bash
curl -X POST https://TU_PROJECT_REF.supabase.co/functions/v1/admin-create-user \
  -H "Content-Type: application/json" \
  -d '{"email":"prueba@ejemplo.com","password":"12345678","full_name":"Prueba","role":"padre"}'
```

### 1.8 Storage (Fase B)

No es necesario ahora. Cuando lleguen los recursos descargables y los documentos:

**Storage** → **New bucket**:

| Bucket | Público | Contenido |
|---|---|---|
| `resources` | ❌ Privado | PDFs y multimedia de la biblioteca |
| `documents` | ❌ Privado | Informes y certificados |
| `avatars` | ✅ Público | Fotos de perfil y de los niños |

Los buckets privados se sirven con **URL firmadas de corta duración**
(`createSignedUrl`, 60 s), nunca con enlaces permanentes. Es un requisito de
[ADR-007](decisiones-arquitectura.md) sobre privacidad de menores.

### 1.9 Archivo de entorno local

```bash
cp .env.example .env.local
```

Edita `.env.local`:

```bash
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
VITE_APP_ENV=development
```

Comprueba que Git no lo va a subir:

```bash
git check-ignore -v .env.local     # debe mostrar la regla que lo excluye
git status --short                 # .env.local NO debe aparecer
```

---

## Parte 2 · Desarrollo local

```bash
npm run dev          # http://localhost:5173
```

Scripts disponibles:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Type-check estricto (`tsc -b`) + build de producción |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run lint` | oxlint (debe dar 0 warnings) |
| `npm run test` | **124 pruebas**: unitarias + integración + UI |
| `npm run test:unit` | Solo validaciones y normalización (16) |
| `npm run test:auth` | Solo integración contra un Supabase simulado (16) |
| `npm run test:ui` | Solo componentes con Vitest + jsdom (92) |
| `npm run check:schema` | 17 invariantes del SQL sobre el AST |
| `npm run check:styles` | Detecta tokens de Tailwind que no generan CSS |
| `npm run verify` | Todo lo anterior en cadena |

**Antes de cada push:**

```bash
npm run verify
```

---

## Parte 3 · GitHub

### 3.1 Inicializar el repositorio

Si el proyecto ya viene con `.git`, salta al [3.3](#33-crear-el-repo-en-github).

```bash
cd aprende-con-sammy

git init -b main
git add .
git status --short        # ← REVISA esto antes de continuar
```

**Comprueba en esa salida:**

- ✅ `.env.example` **sí** aparece (plantilla versionada)
- ❌ `.env.local` **NO** debe aparecer
- ❌ `node_modules/` **NO** debe aparecer
- ❌ `dist/` **NO** debe aparecer

```bash
git commit -m "feat: Aprende con Sammy — auth, UI, routing y esquema Supabase

- Vite 8 + React 19 + TypeScript 5.9 en modo estricto
- Tailwind CSS v4 con tokens de marca (paleta oficial del producto)
- Supabase Auth: registro con upsert defensivo en public.users, login,
  logout, recuperación de contraseña y mapeo de errores a español
- Estado global useAuth con onAuthStateChange y tolerancia a fallos de red
- Sistema de diseño: 8 primitivas + mascota Sammy + 18 iconos SVG propios
- 9 páginas con React Router v7 y carga perezosa por ruta
- Panel de administración con Edge Function (service_role fuera del bundle)
- Esquema SQL: 10 tablas, 40 políticas RLS, 12 triggers, 18 índices
- 124 pruebas (unitarias, integración contra Supabase simulado y UI)"
```

### 3.2 Endurecer la configuración de Git (una sola vez)

```bash
git config --global user.name  "Tu Nombre"
git config --global user.email "tu@email.com"
git config --global init.defaultBranch main
git config --global core.autocrlf input      # Linux/macOS
# git config --global core.autocrlf true     # Windows
```

### 3.3 Crear el repo en GitHub

**Con GitHub CLI (recomendado):**

```bash
gh auth login
#  → GitHub.com → HTTPS → Login with a web browser

gh repo create aprende-con-sammy \
  --private \
  --source=. \
  --remote=origin \
  --push
```

**Sin GitHub CLI:**

1. Crea el repo en <https://github.com/new> — nombre `aprende-con-sammy`,
   **Private**, y **NO** marques "Add a README" ni ".gitignore" (ya los tienes).
2. Conecta y sube:

```bash
git remote add origin https://github.com/TU_USUARIO/aprende-con-sammy.git
git branch -M main
git push -u origin main
```

### 3.4 Proteger la rama principal (recomendado)

En GitHub: **Settings** → **Branches** → **Add branch ruleset** sobre `main`:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass → añade `build` (ver [4.6](#46-ci-opcional))
- ✅ Block force pushes

### 3.5 🔍 Escáner de secretos antes de publicar

Un solo push con la `service_role` obliga a rotarla. Verifica:

```bash
# ¿Alguna clave se coló en el historial?
git log --all --full-history -p | grep -iE "service_role|eyJhbGciOi" | head

# ¿Qué archivos sigue Git?
git ls-files | grep -E "\.env" || echo "✅ ningún .env versionado (salvo .env.example)"
git ls-files | grep -E "^\.env\.example$" && echo "✅ plantilla presente"
```

Si alguna vez commiteaste un secreto, **no basta con borrarlo**: rota la clave
en Supabase y limpia el historial con `git filter-repo`.

---

## Parte 4 · Vercel

### 4.1 Importar el proyecto

1. Entra en <https://vercel.com> → **Sign Up** → *Continue with GitHub*.
2. **Add New…** → **Project**.
3. Junto a `aprende-con-sammy` pulsa **Import** (autoriza el acceso al repo).

### 4.2 Configure Project

Vercel detecta Vite automáticamente. **Verifica que quede exactamente así:**

| Campo | Valor |
|---|---|
| **Project Name** | `aprende-con-sammy` |
| **Framework Preset** | **Vite** |
| **Root Directory** | `./` *(déjalo vacío si el repo contiene solo este proyecto)* |
| **Build Command** | `npm run build` *(o déjalo en blanco: `vercel.json` ya lo fija)* |
| **Output Directory** | `dist` |
| **Install Command** | `npm ci` |

Despliega **Build and Output Settings** y confirma que coinciden. El repositorio
incluye [`vercel.json`](../vercel.json), que fija estos mismos valores y añade la
reescritura SPA — imprescindible con `BrowserRouter`.

### 4.3 ⚙️ Node.js Version

**Settings → General → Node.js Version → `22.x`**

Obligatorio por [ADR-008](decisiones-arquitectura.md). El build de Vite no
instancia el cliente de Supabase, pero cualquier test o script de CI sí, y con
Node 20 fallan.

### 4.4 🔑 Environment Variables

**Settings → Environment Variables → Add New**

Crea **exactamente estas dos**, una por una:

| Name | Value | Type | Environments |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `https://TU_PROJECT_REF.supabase.co` | **Config** | ☑ Production ☑ Preview ☑ Development |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | **Config** | ☑ Production ☑ Preview ☑ Development |

**Detalles que importan:**

- **Type = `Config`**, no `Secret`. Las variables `Config` se inyectan en tiempo
  de *build* — que es exactamente cuando Vite reemplaza `import.meta.env.VITE_*`
  por su valor literal en el bundle. Como `Secret` no estarían disponibles.
- **Marca los tres entornos.** Si olvidas Preview, las URLs de preview fallarán
  con el mensaje de configuración que muestra `ProtectedRoute`.
- **Sin comillas ni espacios.** Vercel no las añade; si copias `"https://..."`
  con comillas, la URL queda malformada.
- **Sin `NEXT_PUBLIC_`.** El prefijo es `VITE_` (Regla 2 del proyecto).
- La `service_role` **NO** va aquí. Es un secreto exclusivo de la Edge Function
  (`supabase secrets set`).

Opcionales:

| Name | Value | Type |
|---|---|---|
| `VITE_APP_ENV` | `production` | Config |
| `VITE_APP_NAME` | `Aprende con Sammy` | Config |

### 4.5 Deploy

Pulsa **Deploy**. Primer build: 40–90 segundos.

Al terminar, abre la URL de producción y verifica:

1. `/login` carga con la paleta teal y la mascota Sammy.
2. Crea una cuenta real → debe registrarse y crear la fila en `public.users`.
3. **Recarga la página en `/progreso`** → debe seguir funcionando.
   Si da 404, falta la reescritura SPA de `vercel.json`.
4. Abre DevTools → Network → confirma que los assets se sirven con
   `Cache-Control: immutable`.

### 4.6 CI (opcional)

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:    { branches: [main] }
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'    # 22.23.3
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      - run: pip install pglast && npm run check:schema
```

---

## Parte 5 · Verificación post-despliegue

Repite esta lista tras cada deploy:

- [ ] `https://tu-app.vercel.app/login` carga sin errores en consola
- [ ] No aparece el aviso «Configuración pendiente» (significaría que faltan las env vars)
- [ ] Registro completo: crear cuenta → confirmar email → iniciar sesión
- [ ] La fila aparece en **Supabase → Table Editor → users** con `role` correcto
- [ ] Un **educador** ve el campo «Sala que lideras» y se guarda en `sala`
- [ ] Un **padre** NO ve el enlace «Gestión de Usuarios»
- [ ] Forzar `https://tu-app.vercel.app/admin/usuarios` como padre → redirige al inicio con «Acceso restringido»
- [ ] Como **admin**: Gestión de Usuarios lista los usuarios y «Crear Usuario Manualmente» funciona
- [ ] Cerrar sesión devuelve a `/login` y una ruta privada vuelve a redirigir
- [ ] Recargar `/progreso`, `/recursos`, `/familia` no da 404
- [ ] Una URL inexistente muestra el 404 con Sammy
- [ ] **Móvil real:** la navegación inferior no queda tapada por la barra de gestos (iPhone)
- [ ] Lighthouse ≥ 90 en Accesibilidad y Best Practices

**Prueba de RLS desde la consola del navegador** (con sesión de un padre):

```js
// Debe devolver SOLO tu propia fila
await (await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/users?select=*`, {
  headers: {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${(await JSON.parse(localStorage['aprende-con-sammy.auth'])).access_token}`
  }
})).json()
```

Si devuelve más de una fila, la política `users_select` no se aplicó.

---

## Parte 6 · Troubleshooting

| Síntoma | Causa | Solución |
|---|---|---|
| `Node.js 20 detected without native WebSocket support` | Node < 22 | `nvm use` (el `.nvmrc` fija 22.23.3). En Vercel: Settings → Node.js Version → 22.x |
| Pantalla «Configuración pendiente» | Faltan `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Añádelas en Vercel como tipo **Config** en los 3 entornos y **Redeploy** |
| Las env vars están puestas pero no surten efecto | Se añadieron **después** del build | Vercel no rebuild automático al cambiar env vars: **Deployments → ⋯ → Redeploy** |
| `import.meta.env.VITE_X` es `undefined` | Prefijo incorrecto o comillas en el valor | Debe empezar por `VITE_` y sin comillas. Nunca `NEXT_PUBLIC_` ni `process.env` |
| 404 al recargar `/progreso` | Falta la reescritura SPA | Verifica que `vercel.json` esté en la raíz del repo y se haya commiteado |
| `relation "public.users" does not exist` | No se ejecutó el SQL | Ejecuta `supabase/schema.sql` en el SQL Editor |
| `relation "public.profiles" does not exist` | Código viejo que viola la Regla 1 | `grep -rn "profiles" src/` y corrige a `users` |
| Registro OK pero `profile` es `null` | Trigger `handle_new_auth_user` ausente | Re-ejecuta la Sección 1 del SQL. Comprueba: `SELECT * FROM information_schema.triggers WHERE trigger_schema='auth'` |
| `new row violates row-level security policy` al registrarse | Política `users_insert` ausente o `auth.uid()` no coincide | Verifica las 4 políticas con `SELECT * FROM pg_policies WHERE tablename='users'` |
| `duplicate key value violates unique constraint "users_email_key"` | Email ya registrado | Comportamiento correcto: la app muestra «Este email ya tiene una cuenta» |
| El admin no puede crear usuarios | Edge Function sin desplegar o sin el secreto | `supabase functions list` y `supabase secrets list`. Mensaje típico: «La función de administración no está desplegada» |
| `403 Solo un administrador puede crear usuarios` | Tu usuario no tiene `role='admin'` en `public.users` | Ejecuta el `UPDATE` de la sección 1.6 |
| No llega el email de confirmación | Plantilla o SMTP por defecto de Supabase | Auth → Email Templates. En el plan Free el SMTP integrado tiene límite bajo; configura SMTP propio en producción |
| El enlace de confirmación apunta a `localhost` | Falta **Site URL** | Auth → URL Configuration → Site URL = tu dominio de Vercel; añade los Redirect URLs |
| La app va lenta en el primer paint | Chunk grande | Ya mitigado (21 chunks, [ADR-010](decisiones-arquitectura.md)). Revisa con `npm run build` |
| Clases de Tailwind sin efecto | Token mal escrito | `npm run check:styles` lista las que no generan CSS |
| `Cannot find module '@/...'` | Alias sin configurar | Debe estar en `vite.config.ts` **y** en `tsconfig.app.json` (`paths`) |

---

## Parte 7 · Mantenimiento

### 7.1 Cambios de esquema

**Nunca edites el esquema a mano en el SQL Editor una vez hay datos.** Usa migraciones:

```bash
supabase migration new agregar_tabla_asistencia
# edita supabase/migrations/<timestamp>_agregar_tabla_asistencia.sql
supabase db push          # aplica en el proyecto vinculado
```

`supabase/schema.sql` es el **arranque desde cero**. Después de la primera
migración, la fuente de verdad pasa a ser la carpeta `migrations/`.

### 7.2 Rotación de claves

| Clave | Cada cuánto | Cómo |
|---|---|---|
| `anon` | Solo si se filtra | Supabase → Settings → API Keys → *Rotate*. Luego actualiza `.env.local` y Vercel, y **Redeploy** |
| `service_role` | Cada 6–12 meses, o de inmediato si se filtra | Igual. Además: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<nueva>` |
| Database password | Cada 6–12 meses | Settings → Database → Reset |

Tras rotar la `anon`, las sesiones existentes siguen válidas (el JWT se firma con
el `JWT secret`, no con la anon key), pero conviene **Redeploy** para que el
bundle lleve la clave nueva.

### 7.3 Backups

- **Plan Free:** sin backups automáticos. Exporta manualmente con
  `supabase db dump --db-url "$SUPABASE_DB_URL" -f backup.sql`.
- **Plan Pro:** backups diarios automáticos + PITR. Actívalo antes de production.

### 7.4 Monitorización mínima

- **Supabase → Reports:** consultas lentas, uso de la API, tamaño de la BD.
- **Supabase → Logs → Auth:** intentos fallidos de login (señal de ataque).
- **Vercel → Analytics / Speed Insights:** Core Web Vitals reales de los usuarios.
- **Vercel → Deployments:** fallos de build.

### 7.5 Actualización de dependencias

```bash
npm outdated
npm update                       # dentro de los rangos de package.json
npx npm-check-updates -u         # saltos de versión mayor (revisar uno a uno)
npm run verify                   # SIEMPRE antes de commitear
```

Vigila especialmente `vite`, `tailwindcss` y `@supabase/supabase-js`: son los
tres con cambios rupturistas frecuentes.

---

## Siguiente paso

Con esto la Fase A está desplegada. La **Fase B** añade:

- Tabla `children` poblada y vinculación familia↔niño
- Realtime: estado de la sesión en vivo (`sessions.status`) y notas nuevas
- Streaming HLS con URL firmada (Cámara)
- Gráficos de tendencia semanal (Progreso)
- Storage + descarga de recursos y documentos
- Pagos y estado del plan
- Web Push + PWA instalable y acceso offline básico
