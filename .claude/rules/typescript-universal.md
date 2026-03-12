# Universal TypeScript Standards

Source: research/coding-standards.md Section 1

These apply to ALL TypeScript code in the repo. ESLint will enforce most once configured — until then, follow manually.

- **U-001:** No `any` type. Use `unknown`, generics, or Zod parsing instead.
- **U-002:** Named exports only. No `export default` except Next.js App Router conventions (`page.tsx`, `layout.tsx`, `route.ts`).
- **U-003:** `import type` for type-only imports. Never import a type with a runtime import statement.
- **U-004:** `type` over `interface`. Use `interface` only for declaration merging or class `extends`.
- **U-005:** Explicit return types on all exported functions.
- **U-006:** No floating promises. Every promise must be `await`ed, returned, or explicitly `void`ed.
- **U-007:** No misused promises. Never pass async functions where sync callbacks are expected (array methods, event handlers).
- **U-008:** Exhaustive `switch` on discriminated unions. Use `default: never` to catch missing variants at compile time.
- **U-009:** No `as` type assertions. Use type guards or Zod parsing. Exception: `as const` is allowed.
- **U-010:** No TypeScript `enum` keyword. Use `as const` objects with derived union types. (Postgres ENUMs in SQL are fine.)
- **U-011:** Use `satisfies` for config objects — checks the type without widening literal types. (Code review only.)
- **U-012:** Use `as const` for literal objects and arrays that represent fixed data. (Code review only.)
- **U-013:** `noUncheckedIndexedAccess` is enabled in tsconfig — `array[0]` returns `T | undefined`. Handle it.
- **U-014:** No deep barrel re-exports. `index.ts` may re-export from immediate children only — never from nested subdirectories or other packages.
