import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/setup/test-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    sequence: {
      shuffle: false,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setup/',
        'src/fixtures/',
        'src/helpers/',
        'src/utils/',
        'dashboard/',
        'results/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

