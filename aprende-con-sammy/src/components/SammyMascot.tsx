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

/** Paleta de la mascota, alineada con los tokens del producto. */
const FUR_DARK = '#1F2937'
const FUR_LIGHT = '#FFFFFF'
const FUR_EDGE = '#E2E8F0'
const BLUSH = '#FB923C'
const BAMBOO_LEAF = '#10B981'
const BAMBOO_LEAF_LIGHT = '#34D399'
const BAMBOO_STEM = '#059669'

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

      {/* Confeti solo en la pose de celebración */}
      {variant === 'celebrating' ? (
        <g aria-hidden="true">
          <circle cx="34" cy="52" r="4.5" fill="#FBBF24" />
          <circle cx="168" cy="46" r="5" fill="#2DD4BF" />
          <rect x="24" y="96" width="8" height="8" rx="2" fill="#8B5CF6" transform="rotate(18 28 100)" />
          <rect x="166" y="100" width="8" height="8" rx="2" fill="#F97316" transform="rotate(-14 170 104)" />
          <circle cx="52" cy="26" r="3.5" fill="#10B981" />
          <circle cx="150" cy="20" r="3.5" fill="#F43F5E" />
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
        'grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary-400 to-creative-500 shadow-soft',
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
        <BambooSprig x={100} y={48} rotate={0} scale={1.25} />
      </svg>
    </span>
  )
}
