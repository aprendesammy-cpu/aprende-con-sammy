import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Alert, Badge, Button, Input, ProgressBar, Select } from '@/components/ui'

describe('Button', () => {
  it('renderiza su contenido y usa type="button" por defecto', () => {
    render(<Button>Guardar</Button>)
    const button = screen.getByRole('button', { name: 'Guardar' })
    expect(button).toHaveAttribute('type', 'button')
  })

  it('permite declarar explícitamente type="submit"', () => {
    render(<Button type="submit">Enviar</Button>)
    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveAttribute('type', 'submit')
  })

  it('en estado de carga se marca como ocupado y se deshabilita', () => {
    render(<Button loading>Creando</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
  })

  it('dispara onClick cuando está habilitado', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Pulsar</Button>)
    await user.click(screen.getByRole('button', { name: 'Pulsar' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('no dispara onClick mientras está cargando', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} loading>
        Pulsar
      </Button>,
    )
    await user.click(screen.getByRole('button')).catch(() => undefined)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Input', () => {
  it('asocia la etiqueta al campo por htmlFor/id', () => {
    render(<Input label="Nombre del niño" />)
    expect(screen.getByLabelText('Nombre del niño')).toBeInTheDocument()
  })

  it('sin error no marca el campo como inválido', () => {
    render(<Input label="Email" />)
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
  })

  it('con error marca aria-invalid y expone el mensaje como alerta', () => {
    render(<Input label="Email" error="El email no tiene un formato válido." />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')

    const message = screen.getByRole('alert')
    expect(message).toHaveTextContent('El email no tiene un formato válido.')
    expect(input).toHaveAccessibleDescription('El email no tiene un formato válido.')
  })

  it('expone la ayuda como descripción accesible', () => {
    render(<Input label="Email" hint="Usa el email del centro." />)
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Usa el email del centro.',
    )
  })

  it('el error tiene prioridad sobre la ayuda en la descripción', () => {
    render(<Input label="Email" hint="Ayuda" error="Falta el email." />)
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Falta el email.')
    expect(screen.queryByText('Ayuda')).not.toBeInTheDocument()
  })

  it('el conmutador de contraseña alterna el tipo del campo', async () => {
    const user = userEvent.setup()
    render(<Input label="Contraseña" type="password" />)
    const input = screen.getByLabelText('Contraseña')
    expect(input).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(input).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(input).toHaveAttribute('type', 'password')
  })
})

describe('Select', () => {
  const OPTIONS = [
    { value: 'padre', label: 'Padre / Madre' },
    { value: 'educador', label: 'Educador' },
  ]

  it('lista las opciones proporcionadas', () => {
    render(<Select label="Rol" options={OPTIONS} />)
    expect(screen.getByLabelText('Rol')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Padre / Madre' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Educador' })).toBeInTheDocument()
  })

  it('la opción neutra queda deshabilitada para forzar una elección', () => {
    render(<Select label="Rol" options={OPTIONS} placeholder="Selecciona una opción" />)
    expect(screen.getByRole('option', { name: 'Selecciona una opción' })).toBeDisabled()
  })

  it('marca aria-invalid cuando hay error', () => {
    render(<Select label="Rol" options={OPTIONS} error="Selecciona tu rol." />)
    expect(screen.getByLabelText('Rol')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona tu rol.')
  })
})

describe('ProgressBar', () => {
  it('expone los atributos ARIA de progressbar', () => {
    render(<ProgressBar value={42} label="Atención" />)
    const bar = screen.getByRole('progressbar', { name: 'Atención' })
    expect(bar).toHaveAttribute('aria-valuenow', '42')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('recorta un valor por encima del máximo', () => {
    render(<ProgressBar value={180} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('recorta un valor negativo o no numérico', () => {
    const { rerender } = render(<ProgressBar value={-25} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')

    rerender(<ProgressBar value={Number.NaN} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('respeta una escala distinta del porcentaje', () => {
    render(<ProgressBar value={3} max={4} valueLabel="Seguridad: Buena" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuemax', '4')
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(screen.getByText('Seguridad: Buena')).toBeInTheDocument()
  })
})

describe('Alert', () => {
  it('los errores interrumpen al lector de pantalla (role=alert)', () => {
    render(<Alert tone="error">Fallo</Alert>)
    expect(screen.getByRole('alert')).toHaveTextContent('Fallo')
  })

  it('el resto de tonos se anuncian sin interrumpir (role=status)', () => {
    render(<Alert tone="success">Éxito</Alert>)
    expect(screen.getByRole('status')).toHaveTextContent('Éxito')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('muestra el botón de cierre solo si se pasa onDismiss', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <Alert tone="info" onDismiss={onDismiss}>
        Aviso
      </Alert>,
    )
    await user.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('Badge', () => {
  it('renderiza su contenido', () => {
    render(<Badge tone="primary">En sesión</Badge>)
    expect(screen.getByText('En sesión')).toBeInTheDocument()
  })
})
