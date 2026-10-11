/**
 * ============================================================
 *  Sammy — mascota oficial de la plataforma
 * ============================================================
 *  Panda con hojas de bambú, dibujado en SVG inline para que:
 *   - no genere peticiones HTTP adicionales,
 *   - escale sin pérdida a cualquier tamaño,
 *   - herede los tokens de color del producto,
 *   - sea animable con CSS y respete `prefers-reduced-motion`.
 */

/** Poses disponibles de la mascota. */
export type SammyVariant = 'sitting' | 'celebrating' | 'waving'

/** Props de la mascota. */
export interface SammyMascotProps {
  variant?: SammyVariant
  /** Tamaño en píxeles (ancho y alto). Por defecto 160. */
  size?: number
  /** Texto alternativo. Por defecto se deriva de la pose. */
  label?: string
  /** La marca como decorativa (sin texto alternativo). */
  decorative?: boolean
  /** Activa la animación sutil de la pose. Por defecto true. */
  animated?: boolean
  className?: string
}

const LABELS: Record<SammyVariant, string> = {
  sitting: 'Sammy, la mascota de Aprende con Sammy, sentado y saludando',
  celebrating: 'Sammy celebrando un logro',
  waving: 'Sammy saludando',
}

/** Paleta de la mascota, alineada con el brand guide oficial. */
const FUR_DARK = '#1E2A44' /* Profesionalismo (azul oscuro) */
const FUR_LIGHT = '#FFFFFF'
const FUR_EDGE = '#DDE4F0'
const BLUSH = '#FF7D7D' /* Cercanía (coral) */
const BAMBOO_LEAF = '#00B4A6' /* Confianza (teal) */
const BAMBOO_LEAF_LIGHT = '#A8E6CF' /* Calma (verde menta) */
const BAMBOO_STEM = '#009688'
const ACCENT_YELLOW = '#FFCB3D' /* Alegría */
const ACCENT_PURPLE = '#7B61FF' /* Creatividad */
const ACCENT_SKY = '#6EC1F4' /* Claridad */

/**
 * Hoja de bambú reutilizable.
 *
 * @param x Posición horizontal del tallo.
 * @param y Posición vertical del tallo.
 * @param rotate Rotación en grados.
 * @param scale Factor de escala.
 */
function BambooSprig({
  x,
  y,
  rotate = 0,
  scale = 1,
}: {
  x: number
  y: number
  rotate?: number
  scale?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path
        d="M0 0 C 1 -8, 1 -16, 0 -24"
        stroke={BAMBOO_STEM}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M0 -22 C -10 -28, -18 -26, -22 -20 C -14 -14, -5 -16, 0 -22 Z" fill={BAMBOO_LEAF} />
      <path d="M0 -22 C 10 -30, 19 -28, 23 -21 C 14 -14, 5 -16, 0 -22 Z" fill={BAMBOO_LEAF_LIGHT} />
      <path d="M0 -14 C -7 -17, -13 -15, -15 -11 C -9 -7, -3 -9, 0 -14 Z" fill={BAMBOO_LEAF_LIGHT} />
    </g>
  )
}

/**
 * Mascota Sammy en SVG.
 *
 * @param props Pose, tamaño y accesibilidad.
 */
export function SammyMascot({
  variant = 'sitting',
  size = 160,
  label,
  decorative = false,
  animated = true,
  className = '',
}: SammyMascotProps) {
  const title = label ?? LABELS[variant]
  const titleId = `sammy-title-${variant}`

  const motionClass = !animated
    ? ''
    : variant === 'celebrating'
      ? 'animate-pop'
      : variant === 'waving'
        ? 'animate-float'
        : 'animate-float'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative || undefined}
      aria-labelledby={decorative ? undefined : titleId}
      className={[motionClass, 'motion-reduce:animate-none', className]
        .filter(Boolean)
        .join(' ')}
    >
      {!decorative ? <title id={titleId}>{title}</title> : null}

      {/* Confeti solo en la pose de celebración (estrellas, corazones y colores de marca) */}
      {variant === 'celebrating' ? (
        <g aria-hidden="true">
          <circle cx="34" cy="52" r="4.5" fill={ACCENT_YELLOW} />
          <circle cx="168" cy="46" r="5" fill="#00B4A6" />
          <rect x="24" y="96" width="8" height="8" rx="2" fill={ACCENT_PURPLE} transform="rotate(18 28 100)" />
          <rect x="166" y="100" width="8" height="8" rx="2" fill="#FF7D7D" transform="rotate(-14 170 104)" />
          <circle cx="52" cy="26" r="3.5" fill="#A8E6CF" />
          <circle cx="150" cy="20" r="3.5" fill={ACCENT_SKY} />
          {/* Estrella */}
          <path
            d="M46 14 l1.7 3.6 4 .5 -2.9 2.8 .7 4 -3.5 -1.9 -3.5 1.9 .7 -4 -2.9 -2.8 4 -.5 Z"
            fill={ACCENT_YELLOW}
          />
          {/* Corazón */}
          <path
            d="M172 74 c-2.6-2.8-6.4-.6-6.4 2.4 0 2.6 3.6 5 6.4 7.2 2.8-2.2 6.4-4.6 6.4-7.2 0-3-3.8-5.2-6.4-2.4 Z"
            fill="#FF7D7D"
          />
          {/* Bombilla */}
          <g transform="translate(18 70)">
            <circle cx="0" cy="0" r="5" fill={ACCENT_YELLOW} opacity="0.9" />
            <rect x="-2.4" y="4" width="4.8" height="3.6" rx="1.2" fill="#1E2A44" opacity="0.7" />
            <path d="M0 -8 v-3 M-6 -5 l-2.4 -1.8 M6 -5 l2.4 -1.8" stroke={ACCENT_YELLOW} strokeWidth="1.6" strokeLinecap="round" />
          </g>
        </g>
      ) : null}

      {/* Orejas */}
      <circle cx="62" cy="54" r="21" fill={FUR_DARK} />
      <circle cx="138" cy="54" r="21" fill={FUR_DARK} />
      <circle cx="62" cy="54" r="10" fill="#374151" opacity="0.55" />
      <circle cx="138" cy="54" r="10" fill="#374151" opacity="0.55" />

      {/* Cuerpo */}
      <ellipse cx="100" cy="162" rx="47" ry="33" fill={FUR_LIGHT} stroke={FUR_EDGE} strokeWidth="2.5" />
      <ellipse cx="100" cy="170" rx="28" ry="19" fill="#F8FAFC" />

      {/* Patas */}
      <ellipse cx="74" cy="188" rx="15" ry="9.5" fill={FUR_DARK} />
      <ellipse cx="126" cy="188" rx="15" ry="9.5" fill={FUR_DARK} />

      {/* Brazo izquierdo */}
      {variant === 'celebrating' ? (
        <path
          d="M64 150 C 46 142, 36 122, 40 104"
          stroke={FUR_DARK}
          strokeWidth="17"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d="M62 150 C 50 158, 48 172, 56 180"
          stroke={FUR_DARK}
          strokeWidth="17"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Brazo derecho: saluda, celebra o sostiene el bambú */}
      {variant === 'waving' ? (
        <g
          className={animated ? 'animate-wave motion-reduce:animate-none' : undefined}
          style={{ transformOrigin: '138px 148px' }}
        >
          <path
            d="M138 148 C 156 138, 166 118, 162 100"
            stroke={FUR_DARK}
            strokeWidth="17"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="162" cy="98" r="10.5" fill={FUR_DARK} />
        </g>
      ) : variant === 'celebrating' ? (
        <path
          d="M136 150 C 154 142, 164 122, 160 104"
          stroke={FUR_DARK}
          strokeWidth="17"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <>
          <path
            d="M138 150 C 152 156, 158 168, 152 178"
            stroke={FUR_DARK}
            strokeWidth="17"
            strokeLinecap="round"
            fill="none"
          />
          <BambooSprig x={154} y={176} rotate={24} scale={1.05} />
        </>
      )}

      {/* Cabeza */}
      <circle cx="100" cy="92" r="55" fill={FUR_LIGHT} stroke={FUR_EDGE} strokeWidth="2.5" />

      {/* Manchas de los ojos */}
      <ellipse cx="78" cy="90" rx="15.5" ry="20" fill={FUR_DARK} transform="rotate(-18 78 90)" />
      <ellipse cx="122" cy="90" rx="15.5" ry="20" fill={FUR_DARK} transform="rotate(18 122 90)" />

      {/* Ojos */}
      <circle cx="80" cy="87" r="6" fill={FUR_LIGHT} />
      <circle cx="120" cy="87" r="6" fill={FUR_LIGHT} />
      <circle cx="81.5" cy="88" r="3.1" fill={FUR_DARK} />
      <circle cx="118.5" cy="88" r="3.1" fill={FUR_DARK} />
      <circle cx="82.8" cy="86.2" r="1.15" fill={FUR_LIGHT} />
      <circle cx="119.8" cy="86.2" r="1.15" fill={FUR_LIGHT} />

      {/* Nariz y boca */}
      <ellipse cx="100" cy="105" rx="6.5" ry="4.8" fill={FUR_DARK} />
      {variant === 'celebrating' ? (
        <path
          d="M88 113 C 93 126, 107 126, 112 113"
          stroke={FUR_DARK}
          strokeWidth="3"
          strokeLinecap="round"
          fill={FUR_DARK}
          fillOpacity="0.12"
        />
      ) : (
        <path
          d="M91 112 C 95 118, 105 118, 109 112"
          stroke={FUR_DARK}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Rubor */}
      <ellipse cx="64" cy="106" rx="8.5" ry="5" fill={BLUSH} opacity="0.4" />
      <ellipse cx="136" cy="106" rx="8.5" ry="5" fill={BLUSH} opacity="0.4" />

      {/* Hojas de bambú en la cabeza */}
      <BambooSprig x={100} y={42} rotate={0} scale={1.15} />
      <BambooSprig x={82} y={47} rotate={-32} scale={0.8} />
      <BambooSprig x={118} y={47} rotate={32} scale={0.8} />
    </svg>
  )
}

/**
 * Versión compacta para la barra superior y el favicon contextual.
 *
 * @param props Tamaño y clase.
 */
export function SammyMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={[
        'grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#00B4A6] to-[#7B61FF] shadow-soft',
        className,
      ].join(' ')}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 200 200">
        <circle cx="62" cy="60" r="24" fill={FUR_DARK} />
        <circle cx="138" cy="60" r="24" fill={FUR_DARK} />
        <circle cx="100" cy="104" r="62" fill={FUR_LIGHT} />
        <ellipse cx="76" cy="100" rx="17" ry="22" fill={FUR_DARK} transform="rotate(-18 76 100)" />
        <ellipse cx="124" cy="100" rx="17" ry="22" fill={FUR_DARK} transform="rotate(18 124 100)" />
        <circle cx="78" cy="97" r="6.5" fill={FUR_LIGHT} />
        <circle cx="122" cy="97" r="6.5" fill={FUR_LIGHT} />
        <circle cx="79.5" cy="98" r="3.3" fill={FUR_DARK} />
        <circle cx="120.5" cy="98" r="3.3" fill={FUR_DARK} />
        <ellipse cx="100" cy="118" rx="7" ry="5" fill={FUR_DARK} />
        <path d="M90 126 C 95 133, 105 133, 110 126" stroke={FUR_DARK} strokeWidth="3.4" strokeLinecap="round" fill="none" />
        {/* Rubor de cercanía (coral) */}
        <ellipse cx="66" cy="122" rx="7" ry="4.2" fill={BLUSH} opacity="0.45" />
        <ellipse cx="134" cy="122" rx="7" ry="4.2" fill={BLUSH} opacity="0.45" />
        <BambooSprig x={100} y={48} rotate={0} scale={1.25} />
      </svg>
    </span>
  )
}

/**
 * Logotipo tipográfico oficial "Aprende con Sammy" según el brand guide:
 *  - "Aprende" en Profesionalismo (#1E2A44)
 *  - "con" en Alegría (#FFCB3D)
 *  - "Sammy" en degradado Confianza → Creatividad (#00B4A6 → #7B61FF)
 * Tipografía Baloo 2 e ícono del panda Sammy.
 */
export interface SammyLogoProps {
  /** Tamaño base en píxeles del ícono; el texto escala proporcionalmente. */
  size?: number
  /** Oculta el texto (solo el ícono). */
  iconOnly?: boolean
  className?: string
}

/**
 * Logotipo de la marca con su wordmark tricolor.
 *
 * @param props Tamaño, modo ícono y clase.
 */
export function SammyLogo({ size = 40, iconOnly = false, className = '' }: SammyLogoProps) {
  const textScale = Math.max(0.75, size / 40)

  if (iconOnly) {
    return <SammyMark size={size} className={className} />
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <SammyMark size={size} />
      <span
        className="font-head leading-none font-extrabold tracking-tight whitespace-nowrap"
        style={{ fontSize: `${textScale * 1.0625}rem` }}
      >
        <span className="text-navy-700">Aprende </span>
        <span className="text-sun-400">con </span>
        <span className="text-gradient-sammy">Sammy</span>
      </span>
    </span>
  )
}
