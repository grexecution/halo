import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    include: [
      'packages/**/test/**/*.{spec,test,e2e}.ts',
      'packages/**/*.{spec,test}.ts',
      'apps/**/test/**/*.{spec,test,e2e}.{ts,tsx}',
      'apps/**/*.{spec,test}.{ts,tsx}',
      'services/**/test/**/*.{spec,test,e2e}.ts',
      'services/**/*.{spec,test}.ts',
      'scripts/**/*.{spec,test}.ts',
      'test/**/*.{spec,test}.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // integration tests (.e2e.ts) get one retry; unit tests get none
    retry: 0,
    reporters: ['verbose'],
    environment: 'jsdom',
  },
})
