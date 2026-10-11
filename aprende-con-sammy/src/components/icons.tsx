import type { SVGProps } from 'react'

/**
 * ============================================================
 *  Iconografía propia (SVG inline)
 * ============================================================
 *  Sin dependencias externas: los iconos se bundlean como parte del JS,
 *  no requieren peticiones adicionales y heredan `currentColor`.
 *  Todos usan `aria-hidden` por defecto: el texto accesible lo aporta
 *  el componente que los envuelve.
 */

/** Props comunes de los iconos. */
export type IconProps = SVGProps<SVGSVGElement> & {
  /** Tamaño en píxeles (ancho y alto). Por defecto 24. */
  size?: number
}

/**
 * Envoltorio base que normaliza tamaño, color y accesibilidad.
 *
 * @param props Tamaño, className y atributos SVG adicionales.
 * @param children Trazos del icono.
 */
function Icon({ size = 24, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

/** Inicio / casa. */
export function IconHome(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </Icon>
  )
}

/** Cámara en vivo del aula. */
export function IconCamera(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="m15.5 10.5 5-2.8a.6.6 0 0 1 .9.5v7.6a.6.6 0 0 1-.9.5l-5-2.8z" />
    </Icon>
  )
}

/** Progreso / estadísticas. */
export function IconChart(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 20.5h18" />
      <rect x="4.5" y="12" width="3.5" height="6" rx="1" />
      <rect x="10.25" y="8" width="3.5" height="10" rx="1" />
      <rect x="16" y="4" width="3.5" height="14" rx="1" />
    </Icon>
  )
}

/** Biblioteca de recursos. */
export function IconBook(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v13" />
      <path d="M4 4.5V19a2 2 0 0 0 2 2h14" />
      <path d="M20 17H6a2 2 0 0 0-2 2" />
      <path d="M8 7.5h7" />
    </Icon>
  )
}

/** Perfil de familia. */
export function IconFamily(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <circle cx="17.5" cy="9.5" r="2.4" />
      <path d="M16.4 14.6A5.4 5.4 0 0 1 21.5 20" />
    </Icon>
  )
}

/** Cerrar sesión. */
export function IconLogout(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 4.5H6.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5H14" />
      <path d="m17 8.5 3.5 3.5L17 15.5" />
      <path d="M20 12h-9.5" />
    </Icon>
  )
}

/** Ojo abierto (mostrar contraseña). */
export function IconEye(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

/** Ojo tachado (ocultar contraseña). */
export function IconEyeOff(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.6 6.1A9.6 9.6 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-3.3 4.1" />
      <path d="M6.4 7.9A16.8 16.8 0 0 0 2.5 12S6 18.2 12 18.2a9.4 9.4 0 0 0 4-.85" />
      <path d="m10 10a2.8 2.8 0 0 0 4 4" />
      <path d="m3.5 3.5 17 17" />
    </Icon>
  )
}

/** Correo. */
export function IconMail(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="m3.5 7 7.3 5.2a2 2 0 0 0 2.4 0L20.5 7" />
    </Icon>
  )
}

/** Candado. */
export function IconLock(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
      <path d="M12 14v2.5" />
    </Icon>
  )
}

/** Persona. */
export function IconUser(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" />
    </Icon>
  )
}

/** Pizarra / sala de clases. */
export function IconBoard(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.8" y="4" width="18.4" height="12" rx="2" />
      <path d="M12 16v4" />
      <path d="M8.5 20h7" />
      <path d="m7.5 10 2.2 2.2 4.3-4.4" />
    </Icon>
  )
}

/** Marca de verificación. */
export function IconCheck(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Icon>
  )
}

/** Cerrar / descartar. */
export function IconClose(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </Icon>
  )
}

/** Atención / advertencia. */
export function IconWarning(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.7 3.9 2.9 17.4A1.5 1.5 0 0 0 4.2 19.7h15.6a1.5 1.5 0 0 0 1.3-2.3L13.3 3.9a1.5 1.5 0 0 0-2.6 0" />
      <path d="M12 9v4" />
      <path d="M12 16.4h.01" />
    </Icon>
  )
}

/** Información. */
export function IconInfo(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6h.01" />
    </Icon>
  )
}

/** Error / círculo tachado. */
export function IconError(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </Icon>
  )
}

/** Flecha de avance. */
export function IconArrowRight(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12h14" />
      <path d="m13 6.5 5.5 5.5L13 17.5" />
    </Icon>
  )
}

/** Chevron desplegable (select). */
export function IconChevronDown(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Icon>
  )
}

/** Destello / logro. */
export function IconSparkle(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.2 13.9 9 19.8 11 13.9 13 12 18.8 10.1 13 4.2 11 10.1 9z" />
      <path d="M18.5 16.5 19.3 19l2.2.8-2.2.9-.8 2.2" />
    </Icon>
  )
}

/** Recargar / reintentar. */
export function IconRefresh(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5" />
      <path d="M4 4.5v4h4" />
      <path d="M4 12.5a8 8 0 0 0 13.7 5.2L20 15.5" />
      <path d="M20 19.5v-4h-4" />
    </Icon>
  )
}
