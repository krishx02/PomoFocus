---
paths:
  - "apps/**"
  - "packages/ui/**"
  - "packages/data-access/**"
---

# App-Level Standards

Source: research/coding-standards.md Sections 2d, 2f, 3

## Client Apps (`apps/web/`, `apps/mobile/`, `apps/vscode-extension/`)

- **APP-002:** No Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) in client-side environment variables. Auth SDK credentials managed by `data-access/` only.
- **APP-004:** Platform-secure token storage: HttpOnly cookie (web), `expo-secure-store` (mobile), Keychain (macOS), `SecretStorage` (VS Code). Never localStorage or plain cookies.
- **APP-006:** Auth flow: clients call Supabase Auth directly (via `data-access/auth`). API does NOT proxy auth flows — it only validates JWTs on data requests.

## UI Package (`packages/ui/`)

- **PKG-U02:** No state management imports in UI. Never import Zustand, TanStack Query, or any state library. UI components are pure presentation — data via props only.
- **PKG-U03:** FlashList over FlatList for all scrollable lists. FlashList uses recycling (5-10x faster on mobile).

## Data Access (`packages/data-access/`)

- **PKG-D04:** No React imports in data-access. This package is consumed by MCP server and API tests — neither use React. React hooks belong in `packages/state/`.
