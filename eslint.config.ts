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
      '**/vitest.config.ts',
      '**/metro.config.js',
      '**/metro.config.cjs',
      '**/scripts/**',
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

      // Nx module boundaries (ADR-001)
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            // === Type tag constraints (ADR-001 dependency graph) ===

            // types is a leaf — depends on nothing, no runtime dependencies
            {
              sourceTag: 'type:types',
              onlyDependOnLibsWithTags: [],
              bannedExternalImports: [
                'react', 'react-native', '@supabase/*', 'zustand',
                '@tanstack/*', 'hono', 'expo-*', '@sentry/*',
              ],
            },

            // domain (core, analytics) depends on domain + types — no frameworks, no IO
            {
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: ['type:domain', 'type:types'],
              bannedExternalImports: [
                'react', 'react-dom', 'react-native', 'react-native-*',
                '@supabase/*', '@tanstack/*', 'zustand', 'zustand/*',
                'hono', 'hono/*', 'expo-*', '@sentry/*',
              ],
            },

            // infra (data-access) depends on domain + types — no React, no state management
            {
              sourceTag: 'type:infra',
              onlyDependOnLibsWithTags: ['type:domain', 'type:types'],
              bannedExternalImports: [
                'react', 'react-dom', 'react-native',
                'zustand', 'zustand/*', '@tanstack/*', '@sentry/*',
              ],
            },

            // ble-protocol depends on types only (PKG-B01) — no runtime deps
            {
              sourceTag: 'type:ble',
              onlyDependOnLibsWithTags: ['type:types'],
              bannedExternalImports: [
                'react', 'react-dom', 'react-native', 'react-native-*',
                '@supabase/*', '@tanstack/*', 'zustand', 'zustand/*',
                'hono', 'hono/*', 'expo-*', '@sentry/*',
              ],
            },

            // state depends on domain + infra + types — no direct Supabase
            {
              sourceTag: 'type:state',
              onlyDependOnLibsWithTags: ['type:domain', 'type:infra', 'type:types'],
              bannedExternalImports: ['@supabase/*', '@sentry/*'],
            },

            // ui depends on types only — no business logic, no state, no Supabase
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:types'],
              bannedExternalImports: [
                '@supabase/*', 'zustand', 'zustand/*',
                '@tanstack/*', '@sentry/*',
              ],
            },

            // apps depend on everything
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

            // === Scope tag constraints ===

            // Platform apps can only depend on shared packages
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
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
          ],
        },
      ],
    },
  },

  // ===== Per-package overrides (ADR-001 boundary enforcement) =====

  // 3a. packages/core/ — No IO, No React, No Supabase, No Timers (PKG-C01–C04)
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "setTimeout",
          message:
            "No side effects in core. Receive time as a parameter. See PKG-C04.",
        },
        {
          name: "setInterval",
          message:
            "No side effects in core. Timer drivers belong in apps. See PKG-C04.",
        },
        {
          name: "Date",
          message:
            "No Date in core. Receive timestamps as number parameters. See PKG-C04.",
        },
        {
          name: "performance",
          message: "No performance API in core. See PKG-C04.",
        },
        {
          name: "fetch",
          message:
            "No IO in core. Network calls belong in data-access. See PKG-C01.",
        },
        {
          name: "XMLHttpRequest",
          message: "No IO in core. See PKG-C01.",
        },
        {
          name: "navigator",
          message: "No browser APIs in core. See PKG-C01.",
        },
        {
          name: "window",
          message: "No browser APIs in core. See PKG-C01.",
        },
        {
          name: "document",
          message: "No browser APIs in core. See PKG-C01.",
        },
        {
          name: "process",
          message: "No Node.js APIs in core. See PKG-C01.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react-native", "react-native-*"],
              message:
                "No React in core. React hooks belong in packages/state/. See PKG-C02.",
            },
            {
              group: ["@supabase/*"],
              message:
                "No Supabase in core. Server access belongs in packages/data-access/. See PKG-C03.",
            },
            {
              group: ["@tanstack/*"],
              message:
                "No TanStack Query in core. Query hooks belong in packages/state/.",
            },
            {
              group: ["zustand", "zustand/*"],
              message:
                "No Zustand in core. Stores belong in packages/state/.",
            },
            {
              group: [
                "node:*",
                "fs",
                "path",
                "http",
                "https",
                "net",
                "child_process",
              ],
              message:
                "No Node.js built-ins in core. IO belongs in data-access. See PKG-C01.",
            },
            {
              group: ["expo-*"],
              message:
                "No Expo packages in core. Platform code belongs in apps/. See PKG-C01.",
            },
          ],
        },
      ],
    },
  },

  // 3b. packages/analytics/ — Same IO/React bans as core (PKG-A01)
  {
    files: ["packages/analytics/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "No IO in analytics. See PKG-A01.",
        },
        {
          name: "setTimeout",
          message: "No side effects in analytics. See PKG-A01.",
        },
        {
          name: "setInterval",
          message: "No side effects in analytics. See PKG-A01.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react-native"],
              message: "No React in analytics.",
            },
            {
              group: ["@supabase/*"],
              message: "No Supabase in analytics. See PKG-A01.",
            },
            {
              group: ["@tanstack/*", "zustand", "zustand/*"],
              message: "No state management in analytics.",
            },
            {
              group: ["node:*", "fs", "path", "http", "https", "net"],
              message: "No Node.js built-ins in analytics. See PKG-A01.",
            },
          ],
        },
      ],
    },
  },

  // 3c. packages/data-access/ — No React (PKG-D04)
  {
    files: ["packages/data-access/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react-native"],
              message:
                "No React in data-access. Hooks belong in packages/state/. See PKG-D04.",
            },
            {
              group: ["@tanstack/*"],
              message:
                "No TanStack Query in data-access. Query wrappers belong in packages/state/.",
            },
            {
              group: ["zustand", "zustand/*"],
              message:
                "No Zustand in data-access. Stores belong in packages/state/.",
            },
          ],
        },
      ],
    },
  },

  // 3d. packages/ui/ — No business logic, no state management (PKG-U01, PKG-U02, PKG-U03)
  {
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*"],
              message:
                "No Supabase in UI. UI is pure presentation. See PKG-U01.",
            },
            {
              group: ["zustand", "zustand/*"],
              message:
                "No Zustand in UI. State wiring belongs in app components. See PKG-U02.",
            },
            {
              group: ["@tanstack/*"],
              message:
                "No TanStack Query in UI. Data fetching belongs in app components. See PKG-U02.",
            },
            {
              group: ["@pomofocus/core", "@pomofocus/core/*"],
              message:
                "UI depends on types only, not core. See PKG-U01.",
            },
            {
              group: ["@pomofocus/data-access", "@pomofocus/data-access/*"],
              message:
                "UI depends on types only, not data-access. See PKG-U01.",
            },
            {
              group: ["@pomofocus/state", "@pomofocus/state/*"],
              message:
                "UI depends on types only, not state. See PKG-U01.",
            },
          ],
          paths: [
            {
              name: "react-native",
              importNames: ["FlatList"],
              message:
                "Use FlashList from @shopify/flash-list instead. See PKG-U03.",
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
      // Expo Router conventions (uses index.tsx for routes, _layout.tsx for layouts)
      '**/app/**/index.tsx',
      '**/app/**/_layout.tsx',
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
