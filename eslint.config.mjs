import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/',
      '**/.next/',
      '**/coverage/',
      '**/node_modules/',
      '**/next-env.d.ts',
      'apps/api/drizzle/',
      'packages/contracts/src/generated/',
      '.claude/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Root tooling scripts run on plain Node, outside any package tsconfig.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        URL: 'readonly',
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  prettier,
);
