import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/**
 * Preparación del entorno de pruebas de componentes.
 */

// React 19 + Testing Library: necesario para que `act()` no avise.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// jsdom no implementa estas APIs; se simulan para no falsear resultados.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

afterEach(() => {
  cleanup()
})
