import nxPlugin from '@nx/eslint-plugin';
import importPlugin from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // ===== Ignore generated/build output files =====
  {
    ignores: [
      '**/generated/**',
      '**/database.ts',
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
    ],
  },

  // ===== Base: strict type-checked + stylistic type-checked =====
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // ===== Type-aware parser options + universal rules =====
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importPlugin,
      '@nx': nxPlugin,
    },
    rules: {
      // U-001: No any (explicit, on top of strictTypeChecked)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',

      // U-002: Named exports only
      'import-x/no-default-export': 'error',

      // U-003: import type for type-only imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // U-004: type over interface
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

      // U-005: Explicit return types on exported functions
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
        },
      ],

      // U-006: No floating promises
      '@typescript-eslint/no-floating-promises': 'error',

      // U-007: No misused promises
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false } },
      ],

      // U-008: Exhaustive switch on discriminated unions
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // U-010: No enum keyword
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message:
            'Use `as const` objects with derived union types instead of enum. See rule U-010.',
        },
      ],

      // Allow underscore-prefixed names to be unused (common convention)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // General safety
      'no-var': 'error',
      'prefer-const': 'error',

      // Nx module boundaries (existing — see issue #54 for future changes)
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            { sourceTag: 'type:types', onlyDependOnLibsWithTags: [] },
            {
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: ['type:domain', 'type:types'],
            },
            {
              sourceTag: 'type:infra',
              onlyDependOnLibsWithTags: ['type:domain', 'type:types'],
            },
            {
              sourceTag: 'type:ble',
              onlyDependOnLibsWithTags: ['type:types'],
            },
            {
              sourceTag: 'type:state',
              onlyDependOnLibsWithTags: ['type:domain', 'type:infra', 'type:types'],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:types'],
            },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:state',
                'type:domain',
                'type:infra',
                'type:ble',
                'type:ui',
                'type:types',
              ],
            },
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:mobile',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:vscode',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:mcp',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
          ],
        },
      ],
    },
  },

  // ===== Framework file exceptions for U-002 (default exports) =====
  {
    files: [
      // Next.js App Router conventions
      '**/page.tsx',
      '**/layout.tsx',
      '**/loading.tsx',
      '**/error.tsx',
      '**/not-found.tsx',
      '**/route.ts',
      '**/middleware.ts',
      // Expo Router conventions (uses index.tsx for routes)
      '**/app/**/index.tsx',
      // Hono / Cloudflare Workers entry point (export default app)
      'apps/api/src/index.ts',
      // Config files
      '**/next.config.*',
      '**/vitest.config.*',
      '**/eslint.config.*',
      '**/tailwind.config.*',
      '**/app.config.*',
    ],
    rules: {
      'import-x/no-default-export': 'off',
    },
  },
);
