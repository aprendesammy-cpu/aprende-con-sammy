import { IconChart, IconSparkle } from '@/components/icons'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'

/**
 * Seguimiento de progreso.
 *
 * Las cinco competencias del modelo pedagógico ya están declaradas aquí: cuando
 * la tabla `progress` exista (Paso 6), solo habrá que enchufar los datos.
 * Las barras se muestran a cero, no con cifras inventadas.
 */

const COMPETENCIES = [
  { key: 'autonomia', label: 'Autonomía', tone: 'success' },
  { key: 'atencion', label: 'Atención', tone: 'primary' },
  { key: 'organizacion', label: 'Organización', tone: 'sun' },
  { key: 'comunicacion', label: 'Comunicación', tone: 'coral' },
  { key: 'aprendizaje', label: 'Aprendizaje', tone: 'creative' },
] as const

function ProgressPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold text-navy-700 sm:text-3xl">Progreso</h1>
        <p className="mt-1 text-sm text-muted">
          Competencias, tendencia semanal y logros alcanzados.
        </p>
      </header>

      <Card
        title="Competencias"
        subtitle="Barras de progreso por competencia"
        icon={<IconChart size={20} />}
        action={<Badge tone="neutral">Sin registros</Badge>}
      >
        <div className="flex flex-col gap-4">
          {COMPETENCIES.map((item) => (
            <ProgressBar
              key={item.key}
              label={item.label}
              value={0}
              tone={item.tone}
              valueLabel="Sin datos"
            />
          ))}
        </div>
      </Card>

      <Card title="Tendencia semanal" icon={<IconSparkle size={20} />}>
        <EmptyState
          variant="celebrating"
          title="Aún no hay lecciones registradas"
          description={
            <>
              Cuando los educadores registren sesiones verás aquí el gráfico de tendencia,
              las lecciones completadas, el tiempo de estudio diario y los hitos alcanzados.
              <br />
              <span className="mt-2 block text-xs">
                Depende de las tablas <code>progress</code> y <code>sessions</code> del Paso 6.
              </span>
            </>
          }
        />
      </Card>
    </div>
  )
}

export default ProgressPage
