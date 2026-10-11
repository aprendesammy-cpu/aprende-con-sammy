import assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import {
  getFirstName,
  isRecord,
  isValidEmail,
  MAX_TEXT_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  normalizeName,
  truncateText,
} from '../src/lib/utils.ts'

describe('normalizeEmail — Regla Estricta 3', () => {
  test('convierte a minúsculas y recorta espacios', () => {
    assert.equal(normalizeEmail('  Ana.Torres@Gmail.COM  '), 'ana.torres@gmail.com')
  })

  test('dos entradas que difieren solo en mayúsculas normalizan igual', () => {
    assert.equal(normalizeEmail('SAMMY@Escuela.CL'), normalizeEmail('sammy@escuela.cl'))
  })

  test('no altera un email ya normalizado (idempotente)', () => {
    const email = 'papa@aprendeconsammy.cl'
    assert.equal(normalizeEmail(normalizeEmail(email)), email)
  })

  test('devuelve cadena vacía ante entrada vacía', () => {
    assert.equal(normalizeEmail('   '), '')
  })
})

describe('isValidEmail', () => {
  const validos = ['ana@sammy.cl', 'a.b+c@sub.dominio.com', 'papa@escuela.co.uk']
  const invalidos = ['ana@', '@sammy.cl', 'ana@sammy', 'ana @sammy.cl', '']

  test('acepta emails válidos', () => {
    for (const email of validos) assert.equal(isValidEmail(email), true, email)
  })

  test('rechaza emails inválidos', () => {
    for (const email of invalidos) assert.equal(isValidEmail(email), false, email)
  })
})

describe('normalizeName', () => {
  test('colapsa espacios múltiples y recorta extremos', () => {
    assert.equal(normalizeName('  Ana   María   Torres '), 'Ana María Torres')
  })
})

describe('getFirstName', () => {
  test('extrae el nombre de pila', () => {
    assert.equal(getFirstName('Ana María Torres Leiva'), 'Ana')
  })

  test('devuelve cadena vacía si no hay nombre', () => {
    assert.equal(getFirstName('   '), '')
  })
})

describe('truncateText', () => {
  test('no altera textos dentro del límite', () => {
    assert.equal(truncateText('Sala Arcoíris', MAX_TEXT_LENGTH), 'Sala Arcoíris')
  })

  test('recorta textos que exceden el límite', () => {
    const largo = 'a'.repeat(MAX_TEXT_LENGTH + 50)
    assert.equal(truncateText(largo, MAX_TEXT_LENGTH).length, MAX_TEXT_LENGTH)
  })
})

describe('isRecord', () => {
  test('reconoce objetos y descarta primitivos', () => {
    assert.equal(isRecord({ a: 1 }), true)
    assert.equal(isRecord(null), false)
    assert.equal(isRecord('texto'), false)
    assert.equal(isRecord(undefined), false)
  })
})

describe('Constantes de validación', () => {
  test('la contraseña mínima coincide con la política de Supabase', () => {
    assert.equal(MIN_PASSWORD_LENGTH, 8)
  })
})
