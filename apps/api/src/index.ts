import { OpenAPIHono } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { corsMiddleware } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';
import type { AuthVariables } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import type { SupabaseEnv } from './lib/supabase.js';
import { registerHealthRoute } from './routes/health.js';
import { registerInviteRoute } from './routes/invite.js';
import { registerMeRoute } from './routes/me.js';
import { registerSessionsRoute } from './routes/sessions.js';
import type { AppEnv } from './types.js';

const app = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: 'Validation failed', details: result.error.flatten() }, 422);
    }
  },
});

app.use('*', corsMiddleware);
app.onError(errorHandler);

/**
 * Auth middleware applies to all /v1/* routes except public ones.
 * /health and /v1/invite/* remain publicly accessible (ADR-018).
 *
 * Typed with the same narrower env generic as `authMiddleware` itself so
 * Hono's contravariant middleware typing accepts it when mounted on AppEnv.
 */
const v1AuthGuard: MiddlewareHandler<{
  Bindings: SupabaseEnv;
  Variables: AuthVariables;
}> = async (c, next) => {
  if (c.req.path.startsWith('/v1/invite/')) {
    return next();
  }
  return authMiddleware(c, next);
};

app.use('/v1/*', v1AuthGuard);

registerHealthRoute(app);
registerInviteRoute(app);
registerMeRoute(app);
registerSessionsRoute(app);

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'PomoFocus API',
    version: '0.1.0',
  },
  security: [{ Bearer: [] }],
});

app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Supabase JWT access token',
});

export default app;
