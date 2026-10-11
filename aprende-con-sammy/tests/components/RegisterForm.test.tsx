import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RegisterForm } from '@/components/RegisterForm'
import type { AuthResult } from '@/types'

/**
 * `vi.hoisted` garantiza que el spy exista antes de que Vitest hoistee
 * `vi.mock` por encima de los imports.
 */
const { registerMock } = vi.hoisted(() => ({ registerMock: vi.fn() }))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    isAuthenticated: false,
    role: null,
    configError: null,
    profileError: null,
    register: registerMock,
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
    hasRole: () => false,
  }),
  useOptionalAuth: () => null,
  useAuthState: () => ({
    user: null,
    profile: null,
    loading: false,
    isAuthenticated: false,
    role: null,
  }),
}))

/** Resultado por defecto: registro exitoso con sesión inmediata. */
const SUCCESS: AuthResult = {
  success: true,
  message: '¡Cuenta creada con éxito! Bienvenido a Aprende con Sammy.',
  user: null,
  profile: null,
  requiresConfirmation: false,
}

/**
 * Rellena el formulario completo como educador.
 *
 * @param user Instancia de userEvent.
 */
async function fillEducatorForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/nombre completo/i), 'Ana María Torres')
  await user.type(screen.getByLabelText(/correo electrónico/i), '  Ana.Torres@SAMMY.CL ')
  await user.type(screen.getByLabelText(/^contraseña/i), 'clave-segura-123')
  await user.selectOptions(screen.getByLabelText(/cuál es tu rol/i), 'educador')
  await user.type(screen.getByLabelText(/sala que lideras/i), '  Sala Arcoíris  ')
}

describe('RegisterForm — campo condicional "Sala que lideras"', () => {
  beforeEach(() => {
    registerMock.mockResolvedValue(SUCCESS)
  })

  it('no muestra el campo de sala al abrir el formulario', () => {
    render(<RegisterForm />)
    expect(screen.queryByLabelText(/sala que lideras/i)).not.toBeInTheDocument()
  })

  it('muestra el campo de sala al seleccionar el rol Educador', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.selectOptions(screen.getByLabelText(/cuál es tu rol/i), 'educador')

    expect(await screen.findByLabelText(/sala que lideras/i)).toBeInTheDocument()
  })

  it('oculta el campo de sala al volver al rol Padre', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.selectOptions(screen.getByLabelText(/cuál es tu rol/i), 'educador')
    expect(await screen.findByLabelText(/sala que lideras/i)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/cuál es tu rol/i), 'padre')
    await waitFor(() =>
      expect(screen.queryByLabelText(/sala que lideras/i)).not.toBeInTheDocument(),
    )
  })

  it('solo ofrece roles registrables: admin no aparece', () => {
    render(<RegisterForm />)
    expect(screen.getByRole('option', { name: 'Padre / Madre' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Educador' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /administrador/i })).not.toBeInTheDocument()
  })
})

describe('RegisterForm — validación antes de tocar la red', () => {
  beforeEach(() => {
    registerMock.mockResolvedValue(SUCCESS)
  })

  it('al enviar vacío muestra los errores y NO llama a register', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByText('Escribe tu nombre completo.')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu email.')).toBeInTheDocument()
    expect(screen.getByText('Escribe una contraseña.')).toBeInTheDocument()
    expect(screen.getByText('Selecciona tu rol.')).toBeInTheDocument()
    expect(registerMock).not.toHaveBeenCalled()
  })

  it('exige nombre y apellido', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/nombre completo/i), 'Ana')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByText('Incluye nombre y apellido.')).toBeInTheDocument()
    expect(registerMock).not.toHaveBeenCalled()
  })

  it('no muestra errores antes de visitar el campo ni de enviar', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/^contraseña/i), '123')
    expect(
      screen.queryByText('La contraseña debe tener al menos 8 caracteres.'),
    ).not.toBeInTheDocument()
  })

  it('muestra el error de contraseña al salir del campo', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/^contraseña/i), '123')
    await user.tab() // abandona el campo → queda "tocado"

    expect(
      await screen.findByText('La contraseña debe tener al menos 8 caracteres.'),
    ).toBeInTheDocument()
  })

  it('exige la sala si el rol es educador', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/nombre completo/i), 'Ana María Torres')
    await user.type(screen.getByLabelText(/correo electrónico/i), 'ana@sammy.cl')
    await user.type(screen.getByLabelText(/^contraseña/i), 'clave-segura-123')
    await user.selectOptions(screen.getByLabelText(/cuál es tu rol/i), 'educador')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByText('Indica la sala que lideras.')).toBeInTheDocument()
    expect(registerMock).not.toHaveBeenCalled()
  })

  it('marca los campos inválidos con aria-invalid', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/nombre completo/i)).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute(
        'aria-invalid',
        'true',
      )
    })
  })
})

describe('RegisterForm — envío y respuesta del servidor', () => {
  beforeEach(() => {
    registerMock.mockResolvedValue(SUCCESS)
  })

  it('normaliza email y sala antes de enviarlos', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await fillEducatorForm(user)
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1))
    expect(registerMock).toHaveBeenCalledWith({
      fullName: 'Ana María Torres',
      email: 'ana.torres@sammy.cl',
      password: 'clave-segura-123',
      role: 'educador',
      sala: 'Sala Arcoíris',
    })
  })

  it('no envía el campo sala cuando el rol es padre', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/nombre completo/i), 'Carlos Muñoz')
    await user.type(screen.getByLabelText(/correo electrónico/i), 'carlos@sammy.cl')
    await user.type(screen.getByLabelText(/^contraseña/i), 'clave-segura-123')
    await user.selectOptions(screen.getByLabelText(/cuál es tu rol/i), 'padre')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1))
    expect(registerMock.mock.calls[0]?.[0]).not.toHaveProperty('sala')
  })

  it('muestra el mensaje de error devuelto por el servidor', async () => {
    registerMock.mockResolvedValue({
      success: false,
      message: 'Este email ya tiene una cuenta. Inicia sesión o recupera tu contraseña.',
    } satisfies AuthResult)

    const user = userEvent.setup()
    render(<RegisterForm />)

    await fillEducatorForm(user)
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Este email ya tiene una cuenta.')
  })

  it('muestra el panel de confirmación si falta validar el email', async () => {
    registerMock.mockResolvedValue({
      success: true,
      message: '¡Cuenta creada! Revisa tu email para confirmar la cuenta.',
      requiresConfirmation: true,
    } satisfies AuthResult)

    const user = userEvent.setup()
    render(<RegisterForm />)

    await fillEducatorForm(user)
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByText('¡Casi listo!')).toBeInTheDocument()
    expect(screen.getByText(/revisa tu email para confirmar/i)).toBeInTheDocument()
    // El formulario desaparece: evita reenvíos duplicados.
    expect(screen.queryByRole('button', { name: /crear cuenta/i })).not.toBeInTheDocument()
  })

  it('invoca onSuccess cuando el registro crea una sesión', async () => {
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(<RegisterForm onSuccess={onSuccess} />)

    await fillEducatorForm(user)
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSuccess.mock.calls[0]?.[0]).toMatchObject({ success: true })
  })

  it('no invoca onSuccess si el registro queda pendiente de confirmación', async () => {
    registerMock.mockResolvedValue({
      success: true,
      message: 'Revisa tu email.',
      requiresConfirmation: true,
    } satisfies AuthResult)

    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(<RegisterForm onSuccess={onSuccess} />)

    await fillEducatorForm(user)
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    await screen.findByText('¡Casi listo!')
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

describe('RegisterForm — indicador de fuerza de contraseña', () => {
  it('aparece solo cuando hay contraseña escrita', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    expect(screen.queryByText(/seguridad:/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/^contraseña/i), 'abc')
    expect(await screen.findByText(/seguridad:/i)).toBeInTheDocument()
  })

  it('mejora la valoración con una contraseña robusta', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    const password = screen.getByLabelText(/^contraseña/i)

    // 8 caracteres con un dígito puntúa 2/4 → "Aceptable".
    await user.type(password, 'abcdefg1')
    expect((await screen.findByText(/seguridad:/i)).textContent).toMatch(/Aceptable/)

    await user.clear(password)
    await user.type(password, 'abc')
    await waitFor(() => expect(screen.getByText(/seguridad:/i).textContent).toMatch(/Débil/))

    await user.clear(password)
    await user.type(password, 'Clave-Segura-2026!')
    await waitFor(() =>
      expect(screen.getByText(/seguridad:/i).textContent).toMatch(/Excelente|Buena/),
    )
  })
})
