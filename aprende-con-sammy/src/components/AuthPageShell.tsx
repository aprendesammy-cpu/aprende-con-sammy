import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { SammyMascot, SammyMark, type SammyVariant } from '@/components/SammyMascot'

/**
 * Envoltorio de las pantallas de autenticación.
 *
 * En móvil: una columna con la mascota arriba. En escritorio: dos columnas,
 * con el panel de marca a la izquierda y el formulario a la derecha.
 */

/** Props del envoltorio. */
export interface AuthPageShellProps {
  title: string
  subtitle: ReactNode
  /** Pose de Sammy. */
  variant?: SammyVariant
  /** Contenido principal (el formulario). */
  children: ReactNode
  /** Contenido bajo la tarjeta (enlaces legales, ayuda…). */
  footer?: ReactNode
}

/** Puntos destacados del panel de marca. */
const HIGHLIGHTS = [
  'Sigue el progreso de tus hijos en tiempo real',
  'Observa la sesión de clase en vivo',
  'Recibe notas y recursos de los educadores',
]

/**
 * Pantalla de acceso y registro con identidad de producto.
 *
 * @param props Título, subtítulo y formulario.
 */
export function AuthPageShell({
  title,
  subtitle,
  variant = 'waving',
  children,
  footer,
}: AuthPageShellProps) {
  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-2">
      {/* ── Panel de marca (solo escritorio) ─────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-navy-700 via-navy-800 to-primary-700 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="inline-flex items-center gap-3">
          <SammyMark size={42} />
          <span className="text-lg font-extrabold tracking-tight">Aprende con Sammy</span>
        </Link>

        <div className="max-w-md">
          <SammyMascot variant="celebrating" size={210} className="mb-7" />
          <h2 className="text-3xl leading-tight font-extrabold text-white">
            Acompaña cada paso de su aprendizaje
          </h2>
          <ul className="mt-6 flex flex-col gap-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/85">
                <span
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-400 text-[11px] font-black text-navy-900"
                  aria-hidden="true"
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/60">
          Datos de menores protegidos con RLS y cumplimiento COPPA / GDPR-K.
        </p>
      </aside>

      {/* ── Columna del formulario ───────────────────────────────── */}
      <main className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link
            to="/"
            className="mb-7 inline-flex items-center gap-2.5 lg:hidden"
            aria-label="Ir al inicio"
          >
            <SammyMark size={38} />
            <span className="text-base font-extrabold text-navy-700">Aprende con Sammy</span>
          </Link>

          <div className="mb-6 flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="mb-3 lg:hidden">
              <SammyMascot variant={variant} size={110} />
            </span>
            <h1 className="text-2xl font-extrabold text-navy-700 sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
          </div>

          <div className="rounded-card border border-slate-100 bg-white p-5 shadow-card sm:p-7">
            {children}
          </div>

          {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
        </div>
      </main>
    </div>
  )
}
