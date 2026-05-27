import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Next.js `server-only` guard is build-time only and unresolvable under
      // Vitest — alias it to an empty stub so server modules (db, actions)
      // can be imported in tests without per-test mocking.
      'server-only': path.resolve(__dirname, 'src/test/server-only.stub.ts'),
    },
  },
})
