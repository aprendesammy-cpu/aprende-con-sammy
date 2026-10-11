import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

/**
 * Configuración de Vitest para las pruebas de componentes.
 *
 * Se separa de `vite.config.ts` a propósito:
 *  - las pruebas de UI viven en `tests/components/` y corren con Vitest (jsdom);
 *  - las pruebas de integración de `src/lib/auth.ts` viven en `tests/` y corren
 *    con el runner nativo de Node + el arnés de esbuild (ver run-auth-smoke.mts).
 *
 * El `include` explícito evita que Vitest intente ejecutar los archivos de
 * `node:test`, que usan una API distinta.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['tests/components/**/*.test.{ts,tsx}'],
      setupFiles: ['./tests/components/setup.ts'],
      globals: false,
      css: false,
      restoreMocks: true,
      clearMocks: true,
    },
  }),
)
