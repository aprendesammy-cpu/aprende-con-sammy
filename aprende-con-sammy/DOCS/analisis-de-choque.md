# 🔍 Análisis de choque — Especificación de producto vs. Reglas Estrictas

**Fecha:** 2026-10-11
**Estado del código:** Paso 1 completado y verificado (build + lint en verde).

La especificación de producto recibida es excelente como documento de visión, pero
**contradice directamente 3 reglas no negociables** definidas en el encargo original.
Este documento expone el choque y propone la resolución.

---

## 🚨 CONFLICTOS BLOQUEANTES

### C1. Stack tecnológico

| | Especificación de producto | Reglas estrictas originales (ya implementadas) |
|---|---|---|
| Framework | React Native + Expo | **Vite + React 18+ + TypeScript** |
| Navegación | Expo Router (`app/(tabs)/…`) | **React Router DOM** |
| Estilos | StyleSheet / NativeWind | **Tailwind CSS** |
| Despliegue | App Store / Play Store | **Vercel (Preset: Vite, Output: `dist`)** |
| Gráficos | `react-native-chart-kit`, Victory Native | Recharts / visx (web) |
| Streaming | AWS IVS / Mux | Igual (HLS en `<video>`) |

**Impacto:** son dos aplicaciones distintas. React Native **no se despliega en Vercel**
como preset Vite, y Expo Router no es React Router DOM. El Paso 1 ya ejecutado
(`vite.config.ts`, `tsconfig.app.json`, `index.html`, Tailwind v4) quedaría descartado.

**Resolución propuesta → R1:** mantener **Vite + React + TypeScript + Tailwind + React
Router DOM + Vercel** y consumir la especificación como **documento de producto**, no de
stack. La app web se construye **mobile-first** (bottom navigation, targets táctiles ≥44 px,
`100dvh`, PWA instalable), de modo que en el móvil *se siente* nativa y además funciona en
el navegador del centro educativo. React Native queda como candidato de Fase 3 reutilizando
**el mismo backend Supabase** (la capa `lib/` y los tipos son portables al 100 %).

---

### C2. Nombre de la tabla de usuarios

| Especificación | Regla estricta original |
|---|---|
| `profiles` — Usuarios (padres, educadores) | **«La tabla se llama SIEMPRE `users`. NUNCA uses `profiles`.»** |

**Impacto:** la Regla 1 es explícita y absoluta. Además, el script SQL maestro del Paso 6
ya está diseñado sobre `public.users` con trigger `handle_new_auth_user`, RLS por `id` y
rol `admin`.

**Resolución propuesta → R2:** mantener **`public.users`**. Todas las referencias de la
especificación a `profiles` se mapean a `users`. El resto de tablas del dominio sí se crean
tal cual (`children`, `sessions`, `progress`, `subjects`, `resources`, `articles`, `notes`,
`payments`, `documents`).

---

### C3. Roles

| Especificación | Regla estricta original |
|---|---|
| `padre`, `educador`, `admin` | `'admin' \| 'familia' \| 'educador' \| 'direccion'` |

**Impacto:** `src/types/index.ts` ya define `UserRole` con los 4 roles del encargo. La
especificación usa `padre` en lugar de `familia` y omite `direccion`.

**Resolución propuesta → R3:** mantener **los 4 roles originales**. `padre` (especificación)
= **`familia`** (implementación). `direccion` se conserva porque el Paso 5 exige la ruta
protegida de admin y el rol de dirección tiene permisos de solo-lectura agregada.

---

## ✅ SIN CONFLICTO — se adopta tal cual de la especificación

| Elemento | Decisión |
|---|---|
| Backend Supabase (Auth, PostgreSQL, Storage, Realtime, Edge Functions) | ✔ Idéntico |
| Variables de entorno `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | ✔ Idéntico |
| Normalización de email `email.toLowerCase().trim()` | ✔ Idéntico |
`try/catch` + validación de `error` en todas las funciones | ✔ Idéntico |
| TypeScript estricto con interfaces | ✔ Idéntico |
| Tablas de dominio: `children`, `sessions`, `progress`, `subjects`, `resources`, `articles`, `notes`, `payments`, `documents` | ✔ Se crean en el Paso 6 ampliado |
| RLS («padres solo ven datos de sus hijos») | ✔ Se traduce a `family_id = auth.uid()` sobre `children` |
| Realtime (`postgres_changes`) para estado de sesión, notas y progreso | ✔ |
| Streaming en vivo del aula (HLS) | ✔ con `hls.js` + URL firmada |
| Paleta: Teal `#2DD4BF`, Azul `#1E3A8A`, Amarillo `#FBBF24`, Coral `#F97316`, Púrpura `#8B5CF6`, Verde `#10B981`, Fondo `#F9FAFB`, Texto `#1F2937`/`#6B7280` | ✔ Sustituye la paleta provisional morada/ámbar del Paso 1 |
| Mascota Sammy (panda con bambú; sentado / celebrando / saludando) | ✔ Componente `SammyMascot` + assets |
| Estilo: esquinas 12–16 px, sombras suaves, espaciado generoso, estética iOS | ✔ `--radius-card`, `--shadow-soft` ya existen, se re-escalan |
| Bottom navigation de 5 secciones (Inicio, Cámara, Progreso, Recursos, Familia) | ✔ En móvil; sidebar en desktop |
| COPPA / GDPR-K, encriptación, <2 s de carga, 60 fps, offline básico, accesibilidad | ✔ Requisitos transversales |

---

## 📐 Ajuste de alcance recomendado

La especificación describe un producto de **3 fases y ~9 meses de trabajo**. Intentar
generarla entera en una sola pasada produce código superficial y no funcional. Propuesta:

- **Fase A (los 7 pasos originales, ampliados):** auth completa + tipos de todo el dominio
  + SQL maestro con las 10 tablas + RLS + Layout con bottom nav + Dashboard de padres +
  Progreso + Recursos + Familia + Cámara + Admin. *Esqueleto navegable y real contra Supabase.*
- **Fase B:** Realtime, Storage de documentos, pagos, notificaciones, offline/PWA, tests.
- **Fase C:** módulo educador, gamificación, IA, i18n, y (opcional) app nativa Expo
  reutilizando el mismo backend.

---

## ❓ Pendiente de confirmación

1. ¿R1 (web Vite mobile-first) o pivotar a React Native/Expo?
2. ¿R2 (`users`) confirmado frente a `profiles`?
3. ¿R3 (4 roles, `padre`→`familia`) confirmado?
4. ¿Se adopta la paleta Teal/Azul de la especificación reescribiendo el `@theme` del Paso 1?
5. ¿Se amplía el SQL del Paso 6 a las 10 tablas del dominio, o se mantiene solo `users` por ahora?
