import { IconBook } from '@/components/icons'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * Biblioteca de recursos y Academia para Padres.
 *
 * Las seis categorías de contenido y los cuatro ejes de la academia quedan
 * declarados: el listado real llegará con las tablas `resources` y `articles`.
 */

const CATEGORIES = [
  { label: 'Lectura', tone: 'primary' },
  { label: 'Escritura', tone: 'navy' },
  { label: 'Matemáticas', tone: 'sun' },
  { label: 'Atención', tone: 'coral' },
  { label: 'Lenguaje', tone: 'creative' },
  { label: 'Creatividad', tone: 'success' },
] as const

const ACADEMY_TOPICS = [
  'Rutinas diarias',
  'Establecimiento de límites',
  'Regulación emocional',
  'Desarrollo infantil',
] as const

function ResourcesPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold text-navy-700 sm:text-3xl">Recursos</h1>
        <p className="mt-1 text-sm text-muted">
          Contenido educativo y artículos para reforzar en casa.
        </p>
      </header>

      <Card
        title="Categorías"
        subtitle="Seis áreas de contenido descargable y multimedia"
        icon={<IconBook size={20} />}
        action={<Badge tone="neutral">Vacío</Badge>}
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CATEGORIES.map((item) => (
            <li
              key={item.label}
              className="rounded-card border border-slate-100 bg-cream px-4 py-5 text-center"
            >
              <span className="block text-sm font-extrabold text-navy-700">{item.label}</span>
              <span className="mt-1 block text-xs text-muted">0 recursos</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Academia para Padres" subtitle="Artículos y guías breves">
        <EmptyState
          variant="sitting"
          title="La biblioteca se está preparando"
          description={
            <>
              Los recursos y artículos aparecerán aquí en cuanto se carguen en la plataforma.
              <br />
              <span className="mt-2 block text-xs">
                Depende de las tablas <code>resources</code> y <code>articles</code>, y del
                almacenamiento de archivos (Fase B).
              </span>
            </>
          }
        >
          <ul className="flex flex-wrap justify-center gap-2">
            {ACADEMY_TOPICS.map((topic) => (
              <li key={topic}>
                <Badge tone="neutral">{topic}</Badge>
              </li>
            ))}
          </ul>
        </EmptyState>
      </Card>
    </div>
  )
}

export default ResourcesPage
