import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC handles TypeScript decorators + metadata, which esbuild (vitest default) cannot emit.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    // e2e suites pull Postgres images through Testcontainers.
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true, legacyDecorator: true },
      },
    }),
  ],
});
