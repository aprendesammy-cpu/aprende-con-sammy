import assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import { getSupabaseClient, isSupabaseConfigured } from '../src/lib/supabase.ts'

/**
 * Estos tests se ejecutan SIN variables de entorno para verificar el camino
 * de fallo: la app debe degradar con un mensaje accionable, no reventar.
 */
describe('supabase.ts — Regla Estricta 2 (import.meta.env + prefijo VITE_)', () => {
  test('isSupabaseConfigured() devuelve false sin variables de entorno', () => {
    assert.equal(isSupabaseConfigured(), false)
  })

  test('getSupabaseClient() lanza un error accionable nombrando las variables VITE_', () => {
    assert.throws(
      () => getSupabaseClient(),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /VITE_SUPABASE_URL/)
        assert.match(error.message, /VITE_SUPABASE_ANON_KEY/)
        assert.match(error.message, /Vercel/)
        return true
      },
    )
  })

  test('el mensaje de error NO menciona NEXT_PUBLIC_ ni process.env', () => {
    try {
      getSupabaseClient()
      assert.fail('Debería haber lanzado')
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      assert.ok(!message.includes('NEXT_PUBLIC_'))
      assert.ok(!message.includes('process.env'))
    }
  })
})
