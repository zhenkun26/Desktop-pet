import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      electron: resolve(__dirname, 'test/mocks/electron.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/main/services/**', 'src/shared/**'],
      exclude: ['**/*.test.ts'],
      reporter: ['text', 'json-summary']
    }
  }
})
