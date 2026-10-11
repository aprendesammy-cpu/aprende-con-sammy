import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginForm } from '@/components/LoginForm'
import type { AuthResult } from '@/types'

const { loginMock, resetPasswordMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  resetPasswordMock: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    isAuthenticated: false,
    role: null,
    configError: null,
    profileError: null,
    register: vi.fn(),
    login: loginMock,
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

// `resetPassword` vive en la capa de datos: se aísla para probar solo la UI.
vi.mock('@/lib/auth', () => ({ resetPassword: resetPasswordMock }))

const SUCCESS: AuthResult = { success: true, message: '¡Hola de nuevo, Ana!' }

describe('LoginForm — validación', () => {
  beforeEach(() => {
    loginMock.mockResolvedValue(SUCCESS)
  })

  it('al enviar vacío muestra los errores y NO llama a login', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByText('Escribe tu email.')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('rechaza un email con formato inválido', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText(/correo electrónico/i), 'no-es-un-email')
    await user.type(screen.getByLabelText(/^contraseña/i), 'clave-segura-123')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByText('El email no tiene un formato válido.')).toBeInTheDocument()
    expect(loginMock).not.toHaveBeenCalled()
  })
})

describe('LoginForm — envío', () => {
  beforeEach(() => {
    loginMock.mockResolvedValue(SUCCESS)
  })

  it('normaliza el email antes de enviarlo', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText(/correo electrónico/i), '  Ana.Torres@SAMMY.CL ')
    await user.type(screen.getByLabelText(/^contraseña/i), 'clave-segura-123')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1))
    expect(loginMock).toHaveBeenCalledWith({
      email: 'ana.torres@sammy.cl',
      password: 'clave-segura-123',
    })
  })

  it('muestra el mensaje de credenciales inválidas del servidor', async () => {
    loginMock.mockResolvedValue({
      success: false,
      message: 'Email o contraseña incorrectos. Inténtalo de nuevo.',
    } satisfies AuthResult)

    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText(/correo electrónico/i), 'ana@sammy.cl')
    await user.type(screen.getByLabelText(/^contraseña/i), 'clave-erronea-1')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Email o contraseña incorrectos.')
  })

  it('invoca onSuccess cuando la sesión se establece', async () => {
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(<LoginForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/correo electrónico/i), 'ana@sammy.cl')
    await user.type(screen.getByLabelText(/^contraseña/i), 'clave-segura-123')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })
})

describe('LoginForm — recuperación de contraseña', () => {
  beforeEach(() => {
    loginMock.mockResolvedValue(SUCCESS)
    resetPasswordMock.mockResolvedValue({
      success: true,
      message: 'Si existe una cuenta, recibirás un enlace para restablecer tu contraseña.',
    })
  })

  it('el panel está oculto hasta que se solicita', () => {
    render(<LoginForm />)
    expect(screen.queryByText('Recuperar contraseña')).not.toBeInTheDocument()
  })

  it('no anida formularios: HTML inválido y envío impredecible', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    expect(document.querySelectorAll('form')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    await screen.findByText('Recuperar contraseña')

    // El panel de recuperación vive DENTRO del formulario principal, así que
    // sigue habiendo un único <form> en el documento.
    expect(document.querySelectorAll('form')).toHaveLength(1)
  })

  it('la tecla Enter envía la recuperación', async () => {
    const user = userEvent.setup()
    resetPasswordMock.mockResolvedValue({ success: true, message: 'Enlace enviado.' })
    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    const recoveryInput = await screen.findByLabelText(/correo electrónico/i, {
      selector: '[name="recoveryEmail"]',
    })

    await user.type(recoveryInput, 'ana@sammy.cl{Enter}')

    await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledWith('ana@sammy.cl'))
  })

  it('se abre con el email ya escrito y expone su estado ARIA', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText(/correo electrónico/i), 'ana@sammy.cl')

    const toggle = screen.getByRole('button', { name: /olvidaste tu contraseña/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(await screen.findByText('Recuperar contraseña')).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAttribute('aria-controls', 'panel-recuperacion')
  })

  it('valida el email antes de pedir el enlace', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    const panel = await screen.findByText('Recuperar contraseña')

    await user.type(screen.getByLabelText(/correo electrónico/i, { selector: '[name="recoveryEmail"]' }), 'x')
    await user.click(screen.getByRole('button', { name: /enviar enlace/i }))

    expect(await screen.findByText('El email no tiene un formato válido.')).toBeInTheDocument()
    expect(resetPasswordMock).not.toHaveBeenCalled()
    expect(panel).toBeInTheDocument()
  })

  it('envía el enlace y muestra la confirmación', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    await screen.findByText('Recuperar contraseña')

    await user.type(
      screen.getByLabelText(/correo electrónico/i, { selector: '[name="recoveryEmail"]' }),
      '  Ana@SAMMY.cl ',
    )
    await user.click(screen.getByRole('button', { name: /enviar enlace/i }))

    await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledTimes(1))
    expect(resetPasswordMock).toHaveBeenCalledWith('ana@sammy.cl')
    expect(
      await screen.findByText(/recibirás un enlace para restablecer tu contraseña/i),
    ).toBeInTheDocument()
  })
})
