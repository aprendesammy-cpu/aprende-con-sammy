import { IconCamera } from '@/components/icons'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * Cámara en vivo del aula.
 *
 * El reproductor se implementa en la Fase B: necesita una tabla `sessions`,
 * un proveedor de streaming (AWS IVS / Mux) y URLs firmadas de corta vida.
 * Ver ADR-007 sobre privacidad de menores.
 */
function CameraPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold text-navy-700 sm:text-3xl">Cámara en vivo</h1>
        <p className="mt-1 text-sm text-muted">
          Observa la sesión del aula en tiempo real.
        </p>
      </header>

      <Card
        title="Sala en directo"
        icon={<IconCamera size={20} />}
        action={<Badge tone="neutral">No disponible</Badge>}
      >
        <EmptyState
          variant="sitting"
          title="La transmisión aún no está activa"
          description={
            <>
              Aquí se reproducirá el video del aula con controles de reproducción y
              notificaciones de eventos importantes.
              <br />
              <span className="mt-2 block text-xs">
                Requiere el proveedor de streaming (HLS) y la tabla <code>sessions</code>,
                previstos en la Fase B.
              </span>
            </>
          }
        >
          <ul className="flex flex-col gap-2 text-left text-xs text-muted">
            <li className="rounded-lg bg-cream px-3 py-2">
              🔒 El enlace de video será <strong>firmado y de corta duración</strong>: no se
              puede compartir ni reutilizar.
            </li>
            <li className="rounded-lg bg-cream px-3 py-2">
              👨‍👩‍👧 Solo lo ven las familias vinculadas al niño, validado por RLS en el
              servidor.
            </li>
          </ul>
        </EmptyState>
      </Card>
    </div>
  )
}

export default CameraPage
