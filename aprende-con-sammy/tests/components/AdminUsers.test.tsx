import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminUsers from '@/pages/AdminUsers'
import type { User } from '@/types'

const { listUsersMock, createUserMock, updateRoleMock, deleteUserMock } = vi.hoisted(() => ({
  listUsersMock: vi.fn(),
  createUserMock: vi.fn(),
  updateRoleMock: vi.fn(),
  deleteUserMock: vi.fn(),
}))

// Se aísla la capa de datos: aquí se prueba la UI del panel, no Supabase.
vi.mock('@/lib/users', () => ({
  listUsers: listUsersMock,
  createUserManually: createUserMock,
  updateUserRole: updateRoleMock,
  deleteUser: deleteUserMock,
}))

const NOW = '2026-10-11T00:00:00.000Z'

/** Fixture de tres usuarios con roles distintos. */
const USERS: User[] = [
  {
    id: 'u-admin',
    email: 'admin@sammy.cl',
    name: 'Rosa',
    full_name: 'Rosa Contreras',
    role: 'admin',
    sala: null,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'u-edu',
    email: 'marta@sammy.cl',
    name: 'Marta',
    full_name: 'Marta González',
    role: 'educador',
    sala: 'Sala Arcoíris',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'u-padre',
    email: 'carlos@sammy.cl',
    name: 'Carlos',
    full_name: 'Carlos Muñoz',
    role: 'padre',
    sala: null,
    created_at: NOW,
    updated_at: NOW,
  },
]

/**
 * Devuelve el resultado de éxito que usa la capa de datos.
 *
 * @param data Contenido del campo `data`.
 */
function success<T>(data: T, message = 'ok') {
  return { success: true, message, data }
}

/**
 * Ámbito de consulta acotado a la tabla de escritorio.
 *
 * `UsersTable` renderiza DOS vistas (tarjetas en móvil y tabla en escritorio)
 * y solo las media queries de CSS ocultan una. jsdom no las aplica, así que
 * cualquier texto aparece dos veces en el DOM de prueba. En un navegador real
 * la vista oculta con `display:none` sale del árbol de accesibilidad y del orden
 * de tabulación, por lo que la duplicación es un artefacto del entorno de test.
 */
async function tableScope() {
  return within(await screen.findByRole('table'))
}

/**
 * Comprueba que un texto dejó de existir en cualquier vista.
 *
 * @param text Texto que no debe quedar en el documento.
 */
function expectAbsent(text: string) {
  expect(screen.queryAllByText(text)).toHaveLength(0)
}

describe('AdminUsers — carga del listado', () => {
  beforeEach(() => {
    listUsersMock.mockResolvedValue(success(USERS))
    updateRoleMock.mockResolvedValue(success(USERS[1]))
    deleteUserMock.mockResolvedValue(success(undefined, 'Usuario eliminado de la lista.'))
  })

  it('lista los usuarios de la tabla `users` al montar', async () => {
    render(<AdminUsers />)

    const table = await tableScope()
    expect(table.getByText('Rosa Contreras')).toBeInTheDocument()
    expect(table.getByText('marta@sammy.cl')).toBeInTheDocument()
    expect(table.getByText('carlos@sammy.cl')).toBeInTheDocument()
    expect(listUsersMock).toHaveBeenCalledTimes(1)
  })

  it('muestra los contadores por rol', async () => {
    render(<AdminUsers />)
    await tableScope()

    expect(screen.getByText('Administrador: 1')).toBeInTheDocument()
    expect(screen.getByText('Educador: 1')).toBeInTheDocument()
    expect(screen.getByText('Padre / Madre: 1')).toBeInTheDocument()
    expect(screen.getByText('3 usuarios registrados')).toBeInTheDocument()
  })

  it('muestra la sala solo de quien la tiene', async () => {
    render(<AdminUsers />)
    const table = await tableScope()

    expect(table.getByText('Sala Arcoíris')).toBeInTheDocument()
  })

  it('muestra un estado vacío cuando aún no hay usuarios', async () => {
    listUsersMock.mockResolvedValue(success([]))
    render(<AdminUsers />)

    expect(await screen.findByText('Todavía no hay usuarios')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear el primer usuario/i })).toBeInTheDocument()
  })

  it('muestra el error de carga con opción de reintentar', async () => {
    listUsersMock.mockResolvedValue({
      success: false,
      message: 'No pudimos cargar la lista de usuarios.',
      data: null,
    })

    const user = userEvent.setup()
    render(<AdminUsers />)

    expect(await screen.findByText('No se pudo cargar la lista')).toBeInTheDocument()
    expect(screen.getByText('No pudimos cargar la lista de usuarios.')).toBeInTheDocument()

    listUsersMock.mockResolvedValue(success(USERS))
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    const table = await tableScope()
    expect(table.getByText('Rosa Contreras')).toBeInTheDocument()
    expect(listUsersMock).toHaveBeenCalledTimes(2)
  })
})

describe('AdminUsers — búsqueda', () => {
  beforeEach(() => {
    listUsersMock.mockResolvedValue(success(USERS))
  })

  it('filtra por nombre, email o sala', async () => {
    const user = userEvent.setup()
    render(<AdminUsers />)
    await tableScope()

    await user.type(screen.getByLabelText('Buscar'), 'arcoíris')

    const table = await tableScope()
    await waitFor(() => expect(table.getByText('Marta González')).toBeInTheDocument())
    expect(table.queryByText('Rosa Contreras')).not.toBeInTheDocument()
    expect(screen.getByText('1 de 3 usuarios')).toBeInTheDocument()
  })

  it('normaliza la búsqueda: mayúsculas y espacios no importan', async () => {
    const user = userEvent.setup()
    render(<AdminUsers />)
    await tableScope()

    await user.type(screen.getByLabelText('Buscar'), '  CARLOS@SAMMY.CL ')

    const table = await tableScope()
    await waitFor(() => expect(table.getByText('Carlos Muñoz')).toBeInTheDocument())
    expect(table.queryByText('Rosa Contreras')).not.toBeInTheDocument()
  })

  it('informa cuando no hay coincidencias', async () => {
    const user = userEvent.setup()
    render(<AdminUsers />)
    await tableScope()

    await user.type(screen.getByLabelText('Buscar'), 'zzzz')

    expect(await screen.findByText('Sin coincidencias')).toBeInTheDocument()
  })
})

describe('AdminUsers — creación manual', () => {
  beforeEach(() => {
    listUsersMock.mockResolvedValue(success(USERS))
  })

  it('el diálogo está cerrado hasta que se pulsa el botón', async () => {
    render(<AdminUsers />)
    await tableScope()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('se abre con el botón «Crear Usuario Manualmente»', async () => {
    const user = userEvent.setup()
    render(<AdminUsers />)
    await tableScope()

    await user.click(screen.getByRole('button', { name: /crear usuario manualmente/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Crear usuario manualmente')).toBeInTheDocument()
    // Aquí SÍ se puede asignar el rol admin, a diferencia del registro público.
    expect(within(dialog).getByRole('option', { name: 'Administrador' })).toBeInTheDocument()
  })

  it('muestra el campo «Sala que lidera» solo para el rol educador', async () => {
    const user = userEvent.setup()
    render(<AdminUsers />)
    await tableScope()
    await user.click(screen.getByRole('button', { name: /crear usuario manualmente/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByLabelText(/sala que lidera/i)).not.toBeInTheDocument()

    await user.selectOptions(within(dialog).getByLabelText(/^rol\b/i), 'educador')
    expect(await within(dialog).findByLabelText(/sala que lidera/i)).toBeInTheDocument()
  })

  it('crea el usuario y lo añade a la lista', async () => {
    const created: User = {
      id: 'u-nuevo',
      email: 'sofia@sammy.cl',
      name: 'Sofía',
      full_name: 'Sofía Ríos',
      role: 'padre',
      sala: null,
      created_at: NOW,
      updated_at: NOW,
    }
    createUserMock.mockResolvedValue(success(created, 'Usuario sofia@sammy.cl creado correctamente.'))

    const user = userEvent.setup()
    render(<AdminUsers />)
    await tableScope()
    await user.click(screen.getByRole('button', { name: /crear usuario manualmente/i }))

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/nombre completo/i), 'Sofía Ríos')
    await user.type(within(dialog).getByLabelText(/correo electrónico/i), '  Sofia@SAMMY.cl ')
    await user.type(within(dialog).getByLabelText(/contraseña provisional/i), 'clave-segura-123')
    await user.click(within(dialog).getByRole('button', { name: /crear usuario/i }))

    await waitFor(() => expect(createUserMock).toHaveBeenCalledTimes(1))
    // El email se envía normalizado.
    expect(createUserMock.mock.calls[0]?.[0]).toMatchObject({
      email: 'sofia@sammy.cl',
      fullName: 'Sofía Ríos',
      role: 'padre',
    })

    const table = await tableScope()
    expect(table.getByText('Sofía Ríos')).toBeInTheDocument()
    expect(screen.getByText(/creado correctamente/i)).toBeInTheDocument()
  })

  it('muestra dentro del diálogo el error devuelto por la Edge Function', async () => {
    createUserMock.mockResolvedValue({
      success: false,
      message: 'Este email ya tiene una cuenta registrada.',
      data: null,
    })

    const user = userEvent.setup()
    render(<AdminUsers />)
    await tableScope()
    await user.click(screen.getByRole('button', { name: /crear usuario manualmente/i }))

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/nombre completo/i), 'Sofía Ríos')
    await user.type(within(dialog).getByLabelText(/correo electrónico/i), 'sofia@sammy.cl')
    await user.type(within(dialog).getByLabelText(/contraseña provisional/i), 'clave-segura-123')
    await user.click(within(dialog).getByRole('button', { name: /crear usuario/i }))

    expect(
      await within(dialog).findByText('Este email ya tiene una cuenta registrada.'),
    ).toBeInTheDocument()
    // El diálogo permanece abierto para poder corregir los datos.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

})

describe('AdminUsers — edición de rol y borrado', () => {
  beforeEach(() => {
    listUsersMock.mockResolvedValue(success(USERS))
    deleteUserMock.mockResolvedValue(success(undefined, 'Usuario eliminado de la lista.'))
  })

  it('cambia el rol de un usuario', async () => {
    updateRoleMock.mockResolvedValue(
      success(
        { ...USERS[2], role: 'educador' as const, sala: 'Sala Arcoíris' },
        'Rol actualizado correctamente.',
      ),
    )

    const user = userEvent.setup()
    render(<AdminUsers />)
    await tableScope()

    const table = await tableScope()
    // `rowgroup` es ambiguo (thead y tbody): se busca la fila por su contenido.
    const row = within(table.getByRole('row', { name: /Carlos Muñoz/i }))
    await user.selectOptions(row.getByRole('combobox'), 'educador')

    await waitFor(() => expect(updateRoleMock).toHaveBeenCalledWith('u-padre', 'educador', null))
    expect(await screen.findByText(/rol actualizado/i)).toBeInTheDocument()
  })

  it('revierte el cambio optimista si el servidor lo rechaza', async () => {
    updateRoleMock.mockResolvedValue({
      success: false,
      message: 'No pudimos actualizar el rol. Verifica tus permisos.',
      data: null,
    })

    const user = userEvent.setup()
    render(<AdminUsers />)
    await tableScope()

    const table = await tableScope()
    // `rowgroup` es ambiguo (thead y tbody): se busca la fila por su contenido.
    const row = within(table.getByRole('row', { name: /Carlos Muñoz/i }))
    await user.selectOptions(row.getByRole('combobox'), 'educador')

    expect(
      await screen.findByText('No pudimos actualizar el rol. Verifica tus permisos.'),
    ).toBeInTheDocument()
    // La fila vuelve a mostrar el rol anterior.
    expect(row.getByRole('combobox')).toHaveValue('padre')
  })

  it('el borrado exige confirmación explícita', async () => {
    const user = userEvent.setup()
    render(<AdminUsers />)
    await tableScope()

    const table = await tableScope()
    // `rowgroup` es ambiguo (thead y tbody): se busca la fila por su contenido.
    const row = within(table.getByRole('row', { name: /Carlos Muñoz/i }))

    await user.click(row.getByRole('button', { name: /eliminar usuario/i }))
    expect(deleteUserMock).not.toHaveBeenCalled()
    expect(row.getByText('¿Seguro?')).toBeInTheDocument()

    await user.click(row.getByRole('button', { name: 'No' }))
    expect(deleteUserMock).not.toHaveBeenCalled()

    await user.click(row.getByRole('button', { name: /eliminar usuario/i }))
    await user.click(row.getByRole('button', { name: 'Sí' }))

    await waitFor(() => expect(deleteUserMock).toHaveBeenCalledWith('u-padre'))
    await waitFor(() => expectAbsent('Carlos Muñoz'))
    expect(screen.getByText(/eliminado de la lista/i)).toBeInTheDocument()
  })

  it('muestra el error si el borrado es rechazado por RLS', async () => {
    deleteUserMock.mockResolvedValue({
      success: false,
      message: 'No pudimos eliminar al usuario. Solo un administrador puede hacerlo.',
      data: null,
    })

    const user = userEvent.setup()
    render(<AdminUsers />)
    await tableScope()

    const table = await tableScope()
    // `rowgroup` es ambiguo (thead y tbody): se busca la fila por su contenido.
    const row = within(table.getByRole('row', { name: /Carlos Muñoz/i }))
    await user.click(row.getByRole('button', { name: /eliminar usuario/i }))
    await user.click(row.getByRole('button', { name: 'Sí' }))

    expect(
      await screen.findByText('No pudimos eliminar al usuario. Solo un administrador puede hacerlo.'),
    ).toBeInTheDocument()
    // El usuario permanece en la lista.
    expect(screen.getAllByText('Carlos Muñoz').length).toBeGreaterThan(0)
  })
})
