import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
  },
});
