# 🧭 Decisiones de Arquitectura (ADR) — Aprende con Sammy

Documento vinculante. Toda decisión posterior debe ser coherente con lo aquí registrado.

---

## ADR-001 · Stack tecnológico: **Web (Vite + React) mobile-first**

**Estado:** ACEPTADA (delegada al arquitecto por el cliente, 2026-10-11)

**Contexto.** La especificación de producto pide React Native + Expo + Expo Router.
El encargo original exige Vite + React + Tailwind + React Router DOM + despliegue en
Vercel (Preset Vite, Output `dist`). Son mutuamente excluyentes.

**Decisión.** Se construye la **aplicación web** con Vite + React 19 + TypeScript 5.9 +
Tailwind CSS v4 + React Router DOM v7 + Supabase, desplegada en Vercel, con diseño
**mobile-first**: bottom navigation de 5 secciones, targets táctiles ≥ 44 px, unidades
`dvh`, PWA instalable. En el teléfono se percibe nativa; en el navegador del centro
educativo funciona igual.

**Justificación.**
1. **Velocidad de entrega.** Un solo código base cubre iOS, Android y escritorio. Con Expo
   habría que mantener dos UI y el despliegue en Vercel quedaría descartado.
2. **Alineación con las Reglas Estrictas**, que son no negociables.
3. **Distribución sin fricción.** Las familias abren un enlace; no hay que pasar por
   revisión de App Store para cada cambio, crítico en un producto en fase de validación.
4. **Backend compartido.** Toda la lógica vive en Supabase (Postgres + RLS + Realtime +
   Storage). Si en Fase 3 se justifica una app nativa, se reutilizan `src/types`, `src/lib`
   y las políticas RLS sin reescribir el dominio.

**Consecuencias.**
- ❌ Sin acceso a APIs nativas puras (push APNs/FCM se resuelve con Web Push + PWA).
- ❌ Sin presencia en tiendas en Fase 1.
- ✅ Cámara en vivo por **HLS** (`hls.js` + URL firmada), que funciona en Safari iOS y Chrome.
- ✅ Offline básico vía Service Worker + caché de recursos descargados (Fase B).

**Riesgo aceptado.** Si el negocio exige tienda en Fase 1, se abre un proyecto Expo paralelo
que consume el mismo backend. El coste es de UI, no de datos.

---

## ADR-002 · Tabla de usuarios: **`public.users`**

**Estado:** ACEPTADA (confirmada por el cliente)

La Regla 1 es absoluta: la tabla se llama **siempre `users`**, **nunca `profiles`**.
Toda referencia de la especificación de producto a `profiles` se implementa como
`public.users`. El resto de tablas del dominio (`children`, `sessions`, `progress`,
`subjects`, `resources`, `articles`, `notes`, `payments`, `documents`) se crean con los
nombres de la especificación.

**Motivo operativo.** Evita la colisión conceptual con `auth.users` y con el patrón
habitual de Supabase (`profiles`), que es exactamente la fuente del bug que la Regla 1
quiere prevenir: queries escritas contra una tabla que no existe.

---

## ADR-003 · Roles: **`padre` | `educador` | `admin`**

**Estado:** ACEPTADA (confirmada por el cliente) — **deroga** la definición del Paso 1.

```ts
export type UserRole = 'padre' | 'educador' | 'admin'
```

- Se **elimina** `direccion` y se **renombra** `familia` → **`padre`**, alineando el código
  con el lenguaje de la especificación de producto.
- `PublicRegisterRole = Exclude<UserRole, 'admin'>` → solo `padre` y `educador` pueden
  crearse por registro público. `admin` se asigna exclusivamente por SQL o desde la
  pantalla de Gestión de Usuarios.
- La vista agregada de solo lectura que habría correspondido a `direccion` se cubre con
  `admin` (Fase A) y podrá segregarse en un rol propio si el negocio lo pide, sin migración
  de datos: basta ampliar el `CHECK` de la columna `role`.

---

## ADR-004 · Columna `sala`

**Estado:** ACEPTADA

Se conserva el nombre **`sala`** (no `classroom` ni `grupo`) porque es el término del
encargo original («Sala que lideras») y del contexto preescolar chileno. Es `text NULL`,
obligatoria en la capa de aplicación cuando `role = 'educador'`.

---

## ADR-005 · Identidad visual: paleta de la especificación

**Estado:** ACEPTADA

Se **deroga** la paleta provisional morada/ámbar del Paso 1 y se adoptan los tokens
oficiales: Teal `#2DD4BF` (primario), Azul profundo `#1E3A8A` (títulos), Amarillo
`#FBBF24`, Coral `#F97316`, Púrpura `#8B5CF6`, Verde `#10B981`, Fondo `#F9FAFB`,
Texto `#1F2937` / `#6B7280`. Radios 12–16 px, sombras suaves, estética iOS.
Mascota: **Sammy**, panda con hojas de bambú (sentado / celebrando / saludando).

---

## ADR-006 · Alcance por fases

**Estado:** ACEPTADA (confirmada por el cliente: *ampliar*)

- **Fase A** — Plan de 7 pasos **ampliado al dominio completo**: auth, tipos de las 10
  tablas, SQL maestro con RLS, bottom navigation de 5 secciones (Inicio, Cámara, Progreso,
  Recursos, Familia), Dashboard de padres, Admin. Esqueleto navegable real contra Supabase.
- **Fase B** — Realtime, Storage de documentos, pagos, notificaciones, offline/PWA, tests
  unitarios y CI/CD.
- **Fase C** — Módulo educador completo, gamificación, IA de recomendaciones, i18n
  (EN/PT) y, opcionalmente, app nativa Expo sobre el mismo backend.

**Principio rector:** cada paso entrega código que **compila, pasa lint y funciona**.
No se escribe UI sobre un contrato de datos inexistente.

---

## ADR-007 · Privacidad de menores (COPPA / GDPR-K)

**Estado:** ACEPTADA — restricción transversal

1. Los datos de menores viven **solo** en `children`, nunca en `auth.users` ni en
   metadatos del JWT.
2. RLS: un `padre` únicamente lee `children` donde `parent_id = auth.uid()`.
3. Ninguna pantalla expone datos de otros niños; las listas de educador se filtran por
   sala en el servidor (RLS), no en el cliente.
4. Las URLs de streaming y de documentos se entregan **firmadas y con expiración corta**.
5. Sin analítica de terceros que perfile menores en Fase A.

---

## ADR-008 · Runtime mínimo: **Node 22**

**Estado:** ACEPTADA — descubierta por una prueba de integración fallida

**Contexto.** `@supabase/supabase-js` instancia el cliente **Realtime de forma ansiosa**
dentro de `createClient()`. En Node 20 no existe `WebSocket` global, y el constructor
lanza:

```
Node.js 20 detected without native WebSocket support.
Suggested solution: For Node.js < 22, install "ws" package and provide it via the
transport option: new RealtimeClient(url, { transport: ws })
```

El fallo **no aparece en el navegador** (WebSocket es nativo), por lo que la app funciona
en desarrollo pero revienta cualquier ejecución del cliente fuera del bundler: tests de
integración, SSR, scripts, Edge Functions locales.

**Decisión.** Exigir **Node >= 22.12.0**, declarado en `package.json → engines.node` y en
`.nvmrc` (22.23.3, LTS *Jod*). Coincide con el requisito de Vite 8
(`^20.19.0 || >=22.12.0`), así que se adopta el tramo superior.

**Alternativa descartada.** Añadir `ws` como dependencia y pasar
`realtime: { transport: ws }` solo en Node. Funciona, pero incorpora una dependencia de
runtime y una bifurcación de configuración para resolver algo que Node 22 ya resuelve.

**Consecuencias.**
- En Vercel, fijar la versión de Node a 22.x en *Project → Settings → General → Node.js
  Version* (o `"engines"`, que Vercel respeta). El build de Vite no instancia el cliente,
  pero los tests y cualquier script de CI sí.
- El sandbox de desarrollo usa Node 20; se instaló Node 22.23.3 en `~/.local/node22` para
  ejecutar la suite. En la máquina del desarrollador basta con `nvm use` sobre `.nvmrc`.

---

## ADR-009 · Alta manual de usuarios vía **Edge Function**

**Estado:** ACEPTADA

**Contexto.** El panel de administración necesita crear cuentas. Crear una cuenta
escribe en `auth.users`, y eso solo puede hacerse con la clave `service_role`,
que **ignora todas las políticas RLS**.

**Decisión.** El alta manual NO se hace desde el navegador. Se invoca la Edge
Function `admin-create-user`, que conserva `SUPABASE_SERVICE_ROLE_KEY` como
secreto del servidor.

**Alternativas descartadas.**
1. *Incluir `service_role` en el bundle.* Descartada de plano: la clave es
   pública en cuanto está en el JavaScript, y con ella cualquiera crea, modifica
   o borra usuarios sin pasar por RLS.
2. *`supabase.auth.signUp()` desde el cliente con el admin logueado.* Además de
   enviar un correo de confirmación que nadie pidió, **pisaría la sesión del
   administrador** en el almacenamiento local: acabaría autenticado como el
   usuario que acaba de crear.
3. *Función SQL `SECURITY DEFINER` que escriba en `auth.users`.* Funciona, pero
   el esquema `auth` no es una API estable y rompería con actualizaciones de
   Supabase.

**Defensa en profundidad.** El rol de quien invoca se comprueba **en la función**,
leyendo `public.users` con el token del propio invocador. No basta con que la
ruta esté oculta en el cliente: ocultar la UI no es autorizar.

**Nota sobre `deleteUser`.** Borra la fila de `public.users` pero no la cuenta de
`auth.users` (exigiría otra función con `service_role`). Está documentado en el
código para no dar la falsa impresión de que el usuario desaparece del sistema.

---

## ADR-010 · División del bundle y carga perezosa por ruta

**Estado:** ACEPTADA

Antes: un único chunk de **503,78 kB** (React + React Router + supabase-js + toda
la app). Cualquier cambio invalidaba la caché completa del usuario y un padre
descargaba el código del panel de administración que nunca verá.

Después: **21 chunks**. Cada página con `React.lazy`, y `advancedChunks.groups`
(Vite 8 usa rolldown; es el equivalente a `manualChunks`) separa `react`,
`supabase`, `router` y `vendor`.

| Chunk | Tamaño | gzip |
| --- | --- | --- |
| `react` | 218,75 kB | 68,26 kB |
| `supabase` | 204,47 kB | 52,58 kB |
| `router` | 38,20 kB | 13,67 kB |
| `index` (app) | 35,92 kB | 11,27 kB |
| `AdminUsers` | 15,77 kB | 5,33 kB |
| resto de páginas | 1,2–5,3 kB | — |

Se rechazó subir `chunkSizeWarningLimit`: habría ocultado el aviso sin resolver
el problema.

`Layout` tiene su **propio límite `Suspense`** alrededor del `<Outlet />`. Con un
único límite en la raíz, cada navegación perezosa desmontaría también la barra
superior y la navegación inferior, provocando un parpadeo en toda la interfaz.

---

## ADR-011 · RLS de `users`: SELECT restringido, no «todos los autenticados»

**Estado:** ACEPTADA — **deroga parcialmente** el Paso 6.4 del encargo original

**Contexto.** El plan pedía para `public.users`: *«Select (todos los
autenticados)»*. La tabla contiene `email`, `name`, `full_name`, `role` y `sala`
de **todas** las personas adultas de la comunidad educativa.

**Problema.** Con esa política, cualquier cuenta autenticada puede ejecutar:

```js
await supabase.from('users').select('*')
```

y obtener el censo completo: nombres, correos y roles de todos los padres y
educadores. Es una fuga de datos personales (GDPR art. 5.1.c — minimización;
Ley 19.628 chilena) y un vector directo de phishing dirigido a familias, que es
justo el colectivo menos preparado para detectarlo.

**Decisión.** La política `users_select` permite únicamente:

```sql
USING (id = auth.uid() OR public.is_admin())
```

**Compatibilidad.** Ninguna pantalla necesita el listado completo salvo
*Gestión de Usuarios*, que ya es exclusiva de `admin` por ruta, por RLS y por la
Edge Function. `getUserProfile(userId)` siempre se invoca con el id de la sesión
activa. No hay regresión funcional.

**Cómo revertirla si el negocio lo exige.** Sustituir el cuerpo de la política
por `USING (auth.role() = 'authenticated')`. Está documentado en el propio
`schema.sql`. Lo correcto en ese caso sería crear una **vista** con solo los
campos no sensibles (`name`, `role`, `sala`) y exponer esa vista, no la tabla.

---

## ADR-012 · Prohibido `FORCE ROW LEVEL SECURITY` en `public.users`

**Estado:** ACEPTADA — detectada al validar el esquema

**Contexto.** `FORCE ROW LEVEL SECURITY` extiende RLS al **propietario** de la
tabla. Parece una buena medida de endurecimiento.

**Problema.** El trigger `handle_new_auth_user` es `SECURITY DEFINER`, así que se
ejecuta como `postgres`, que en Supabase es el propietario de las tablas de
`public`. Con FORCE activo, su `INSERT` quedaría sujeto a la política
`users_insert`:

```sql
WITH CHECK (id = auth.uid() OR public.is_admin())
```

Pero en el instante en que GoTrue crea la fila en `auth.users` **todavía no
existe JWT**: `auth.uid()` es `NULL` y `is_admin()` es `false`. El `INSERT` sería
rechazado y **ningún usuario podría registrarse**.

Es cierto que en Supabase el rol `postgres` suele tener el atributo `BYPASSRLS`,
que sí ignora FORCE. Pero no hay razón para apostar el flujo de alta completo a
un detalle de configuración que no se puede verificar desde el repositorio.

**Decisión.** Solo `ENABLE ROW LEVEL SECURITY`. Es suficiente: RLS aplica a los
roles `anon` y `authenticated`, que son los únicos que usa la aplicación.

---

## ADR-013 · Validación automática del esquema

**Estado:** ACEPTADA

El SQL no se revisa a ojo. `scripts/check-schema.py` lo parsea con **libpg_query**
(el parser real de PostgreSQL, vía `pglast`) y comprueba 17 invariantes sobre el
AST:

1. No existe la tabla prohibida `profiles` (Regla 1).
2. Las 10 tablas del dominio existen.
3. No sobra ninguna tabla fuera del alcance.
4. `public.users` tiene exactamente las 8 columnas del Paso 6.2.
5. Todas las tablas tienen `ENABLE ROW LEVEL SECURITY`.
6. Toda tabla con RLS tiene al menos una política de SELECT.
7. `users` tiene las 4 políticas del plan (SELECT, INSERT, UPDATE, DELETE).
8. Existen los triggers `handle_users_updated_at` y `handle_new_auth_user`.
9. Toda tabla con `updated_at` tiene trigger que lo mantenga.
10. No hay claves foráneas colgando.
11. Ninguna política referencia una tabla inexistente.
12. Las funciones auxiliares de autorización están presentes.
13. Toda función `SECURITY DEFINER` fija `search_path` (secuestro de nombres).
14. Ninguna política sobre `users` consulta `public.users` (recursión infinita).
15. `profiles` no aparece en SQL ejecutable (sí se permite en comentarios).
16. Los roles del `CHECK` de SQL coinciden con el tipo `UserRole` de TypeScript.
17. Las columnas de `users` coinciden con la interfaz `User`.

Las dos últimas evitan el **drift** entre base de datos y tipos: si alguien añade
un rol en un sitio y no en el otro, la app escribe valores que Postgres rechaza.
El detector se probó inyectando una divergencia real (`'direccion'`) y
confirmando que falla.

Complemento: `scripts/check-tailwind-tokens.py` hace lo propio con el CSS, porque
un token de Tailwind mal escrito **no rompe el build** — simplemente no genera
ninguna regla.
