import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import {
  SammyMascot,
  SammyMark,
  type SammyVariant,
} from '@/components/SammyMascot'

/**
 * Envoltorio de las pantallas de autenticación — identidad oficial de marca.
 *
 * Fondo: degradado Confianza (#00B4A6, izquierda) → Creatividad (#7B61FF, derecha).
 * En móvil: una columna con el logo grande de Sammy arriba y el formulario a
 * ancho completo sobre tarjeta blanca. En escritorio/tablet: layout split con
 * el panel de marca a la izquierda y el formulario a la derecha.
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

/** Frases decorativas de aliento (Caveat). */
const PHRASES = ['¡Tú puedes!', 'Un paso a la vez.', 'Aprende a tu manera. Avanza con Sammy.']

/** Wordmark tricolor reutilizable: Aprende · con · Sammy. */
function BrandWordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="font-head leading-none font-extrabold tracking-tight whitespace-nowrap">
      <span className={light ? 'text-white' : 'text-navy-700'}>Aprende </span>
      <span className="text-sun-400">con </span>
      {light ? (
        <span className="text-mint">Sammy</span>
      ) : (
        <span className="text-gradient-sammy">Sammy</span>
      )}
    </span>
  )
}

/**
 * Pantalla de acceso y registro con la identidad visual del brand guide.
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
    <div className="min-h-dvh bg-gradient-to-r from-[#00B4A6] via-[#3f9fd8] to-[#7B61FF] lg:grid lg:grid-cols-2">
      {/* ── Panel de marca (izquierda, escritorio) ───────────────── */}
      <aside className="relative hidden overflow-hidden px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Formas orgánicas redondeadas decorativas */}
        <span
          aria-hidden="true"
          className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/10"
        />
        <span
          aria-hidden="true"
          className="absolute right-[-6rem] bottom-[-4rem] h-80 w-80 rounded-full bg-sun-400/20"
        />
        <span aria-hidden="true" className="absolute top-24 right-16 text-3xl opacity-70">✦</span>
        <span aria-hidden="true" className="absolute top-40 left-20 text-xl opacity-60">♥</span>
        <span aria-hidden="true" className="absolute bottom-32 left-10 text-2xl opacity-50">✧</span>

        <Link to="/" className="inline-flex items-center gap-3" aria-label="Ir al inicio">
          <SammyMark size={46} />
          <span className="text-xl">
            <BrandWordmark light />
          </span>
        </Link>

        <div className="relative max-w-md">
          <SammyMascot variant="celebrating" size={220} className="mb-6" />
          <h2 className="font-head text-3xl leading-tight font-extrabold text-white">
            Acompaña cada paso de su aprendizaje
          </h2>
          <ul className="mt-6 flex flex-col gap-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/90">
                <span
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sun-400 text-[11px] font-black text-navy-700"
                  aria-hidden="true"
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="font-script mt-7 text-2xl leading-none text-sun-400">{PHRASES[0]}</p>
        </div>

        <p className="text-xs text-white/70">
          Datos de menores protegidos con RLS y cumplimiento COPPA / GDPR-K ·{' '}
          <a href="mailto:aprendesammy@gmail.com" className="font-bold underline-offset-2 hover:underline">
            aprendesammy@gmail.com
          </a>
        </p>
      </aside>

      {/* ── Columna del formulario (derecha) ─────────────────────── */}
      <main className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-8 lg:rounded-l-[2.5rem] lg:bg-warmwhite lg:px-12">
        <div className="mx-auto w-full max-w-md">
          {/* Logo grande de Sammy (móvil/tablet) */}
          <div className="mb-7 flex flex-col items-center text-center lg:hidden">
            <Link to="/" className="inline-flex items-center gap-3" aria-label="Ir al inicio">
              <SammyMark size={44} />
              <span className="text-lg">
                <BrandWordmark />
              </span>
            </Link>
            <span className="mt-4">
              <SammyMascot variant={variant} size={130} />
            </span>
            <p className="font-script -mt-1 text-xl leading-none text-creative-500">
              {PHRASES[2]}
            </p>
          </div>

          <div className="mb-6 flex flex-col items-center text-center lg:items-start lg:text-left">
            <h1 className="font-head text-2xl font-extrabold text-navy-700 sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
          </div>

          {/* Tarjeta blanca del formulario, con borde menta y sombra de marca */}
          <div className="rounded-card border-2 border-primary-100 bg-white p-5 shadow-card sm:p-7">
            {children}
          </div>

          {footer ? <div className="mt-6 text-center text-sm text-navy-700">{footer}</div> : null}

          <p className="font-script mt-6 hidden text-center text-xl text-white/90 lg:block">
            {PHRASES[1]}
          </p>
        </div>
      </main>
    </div>
  )
}
