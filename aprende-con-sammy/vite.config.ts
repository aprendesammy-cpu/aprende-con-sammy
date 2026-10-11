import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    /**
     * División de paquetes de terceros.
     *
     * Vite 8 usa rolldown: el equivalente a `manualChunks` es
     * `advancedChunks.groups`. Sin esto, React + React Router + supabase-js
     * viajaban en un único chunk de ~504 kB y cualquier cambio de la app
     * invalidaba la caché del usuario.
     *
     * `priority` desempata cuando un módulo encaja en varios grupos.
     */
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: 'supabase',
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 25,
            },
            {
              name: 'router',
              test: /node_modules[\\/](react-router|react-router-dom)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
