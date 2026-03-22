/**
 * Diagnostic script for the PomoFocus local development stack.
 * Runs 6 sequential checks and reports pass/fail with actionable fixes.
 *
 * Usage: pnpm run diagnose
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ANSI color helpers
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

type CheckResult = {
  name: string;
  status: CheckStatus;
  message: string;
};

const API_BASE = 'http://localhost:8787';

function icon(status: CheckStatus): string {
  switch (status) {
    case 'pass':
      return `${GREEN}PASS${RESET}`;
    case 'fail':
      return `${RED}FAIL${RESET}`;
    case 'warn':
      return `${YELLOW}WARN${RESET}`;
    case 'skip':
      return `${GRAY}SKIP${RESET}`;
  }
}

function print(result: CheckResult): void {
  console.log(`  [${icon(result.status)}] ${result.name}`);
  if (result.status !== 'pass') {
    console.log(`         ${result.message}`);
  }
}

async function checkApiReachable(): Promise<CheckResult> {
  const name = 'API reachable (GET /health)';
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.status === 200) {
      const body = (await res.json()) as Record<string, unknown>;
      if (body['status'] === 'ok') {
        return { name, status: 'pass', message: '' };
      }
      return { name, status: 'fail', message: `Unexpected response: ${JSON.stringify(body)}` };
    }
    return { name, status: 'fail', message: `Status ${String(res.status)} — expected 200` };
  } catch {
    return {
      name,
      status: 'fail',
      message: 'Connection refused. Start the API:\n         cd apps/api && npx wrangler dev src/index.ts',
    };
  }
}

async function checkSupabaseConnected(): Promise<CheckResult> {
  const name = 'Supabase connected (GET /v1/sessions)';
  try {
    const res = await fetch(`${API_BASE}/v1/sessions?limit=1`);
    if (res.status === 200) {
      return { name, status: 'pass', message: '' };
    }
    const body = (await res.json()) as Record<string, unknown>;
    const msg = typeof body['error'] === 'string' ? body['error'] : JSON.stringify(body);

    if (msg.includes('does not exist') || msg.includes('relation')) {
      return {
        name,
        status: 'fail',
        message: 'Database tables missing. Run:\n         npx supabase link --project-ref <your-ref>\n         npx supabase db push',
      };
    }
    return { name, status: 'fail', message: `API returned ${String(res.status)}: ${msg}` };
  } catch {
    return { name, status: 'fail', message: 'Failed to connect to API' };
  }
}

async function checkCorsHeaders(): Promise<CheckResult> {
  const name = 'CORS allows localhost:8081';
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Method': 'GET',
      },
    });
    const allowOrigin = res.headers.get('Access-Control-Allow-Origin');
    if (allowOrigin === 'http://localhost:8081') {
      return { name, status: 'pass', message: '' };
    }
    return {
      name,
      status: 'fail',
      message: `Access-Control-Allow-Origin: ${allowOrigin ?? '(missing)'}\n         Add http://localhost:8081 to DEFAULT_DEV_ORIGINS in apps/api/src/middleware/cors.ts`,
    };
  } catch {
    return { name, status: 'fail', message: 'Failed to connect to API' };
  }
}

async function checkSessionCreation(): Promise<CheckResult> {
  const name = 'Session creation (POST /v1/sessions)';
  try {
    const now = new Date().toISOString();
    const res = await fetch(`${API_BASE}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        started_at: now,
        ended_at: now,
      }),
    });

    if (res.status === 201) {
      return { name, status: 'pass', message: '' };
    }

    const body = (await res.json()) as Record<string, unknown>;
    const msg = typeof body['error'] === 'string' ? body['error'] : JSON.stringify(body);

    if (msg.includes('foreign key') || msg.includes('Referenced resource')) {
      return {
        name,
        status: 'fail',
        message:
          'Foreign key error — placeholder user/goal UUIDs have no matching DB rows.\n         Run: npx supabase db push && apply seed data',
      };
    }
    return { name, status: 'fail', message: `Status ${String(res.status)}: ${msg}` };
  } catch {
    return { name, status: 'fail', message: 'Failed to connect to API' };
  }
}

async function checkSessionListing(): Promise<CheckResult> {
  const name = 'Session listing (GET /v1/sessions)';
  try {
    const res = await fetch(`${API_BASE}/v1/sessions?limit=5`);
    if (res.status === 200) {
      const body = (await res.json()) as Record<string, unknown>;
      if (Array.isArray(body['data'])) {
        return { name, status: 'pass', message: '' };
      }
      return { name, status: 'fail', message: `Response missing "data" array: ${JSON.stringify(body)}` };
    }
    return { name, status: 'fail', message: `Status ${String(res.status)}` };
  } catch {
    return { name, status: 'fail', message: 'Failed to connect to API' };
  }
}

function checkWebEnvLocal(): CheckResult {
  const name = 'Web .env.local exists';
  const scriptDir = new URL('.', import.meta.url).pathname;
  const envPath = resolve(scriptDir, '..', 'apps', 'web', '.env.local');
  try {
    const content = readFileSync(envPath, 'utf-8');
    if (content.includes('EXPO_PUBLIC_API_URL')) {
      return { name, status: 'pass', message: '' };
    }
    return {
      name,
      status: 'warn',
      message: 'File exists but EXPO_PUBLIC_API_URL not set.\n         Add: EXPO_PUBLIC_API_URL=http://localhost:8787',
    };
  } catch {
    return {
      name,
      status: 'fail',
      message: 'File missing. Create apps/web/.env.local with:\n         EXPO_PUBLIC_API_URL=http://localhost:8787',
    };
  }
}

async function main(): Promise<void> {
  console.log(`\n${BOLD}PomoFocus Local Dev Diagnostics${RESET}\n`);

  const results: CheckResult[] = [];

  // Check 1: API reachability (gate for checks 2-5)
  const apiResult = await checkApiReachable();
  results.push(apiResult);
  print(apiResult);

  if (apiResult.status === 'fail') {
    // Skip API-dependent checks
    const skipped: CheckResult[] = [
      { name: 'Supabase connected', status: 'skip', message: 'Skipped — API not reachable' },
      { name: 'CORS allows localhost:8081', status: 'skip', message: 'Skipped — API not reachable' },
      { name: 'Session creation', status: 'skip', message: 'Skipped — API not reachable' },
      { name: 'Session listing', status: 'skip', message: 'Skipped — API not reachable' },
    ];
    for (const s of skipped) {
      results.push(s);
      print(s);
    }
  } else {
    // Checks 2-5: API-dependent
    const supabaseResult = await checkSupabaseConnected();
    results.push(supabaseResult);
    print(supabaseResult);

    const corsResult = await checkCorsHeaders();
    results.push(corsResult);
    print(corsResult);

    const createResult = await checkSessionCreation();
    results.push(createResult);
    print(createResult);

    const listResult = await checkSessionListing();
    results.push(listResult);
    print(listResult);
  }

  // Check 6: Web env (always runs)
  const envResult = checkWebEnvLocal();
  results.push(envResult);
  print(envResult);

  // Summary
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const total = results.length;

  console.log(`\n${BOLD}Summary:${RESET} ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`${RED}${failed} issue(s) need fixing.${RESET}`);
  } else {
    console.log(`${GREEN}All checks passed!${RESET}`);
  }
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error('Diagnostic script failed:', err);
  process.exit(2);
});
