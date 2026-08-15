import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    // .tsx too, so renderer tests can assert on real rendered markup.
    include: ['lib/**/*.spec.ts', 'lib/**/*.spec.tsx'],
  },
});
