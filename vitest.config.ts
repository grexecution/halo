import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'packages/**/test/**/*.{spec,test,e2e}.ts',
      'packages/**/*.{spec,test}.ts',
      'apps/**/test/**/*.{spec,test,e2e}.ts',
      'apps/**/*.{spec,test}.ts',
      'services/**/test/**/*.{spec,test,e2e}.ts',
      'services/**/*.{spec,test}.ts',
      'scripts/**/*.{spec,test}.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
    ],
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
