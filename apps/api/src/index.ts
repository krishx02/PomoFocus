import { OpenAPIHono } from '@hono/zod-openapi';
import { corsMiddleware } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { registerHealthRoute } from './routes/health.js';
import { registerMeRoute } from './routes/me.js';
import { registerSessionsRoute } from './routes/sessions.js';
import { registerSettingsRoute } from './routes/settings.js';
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

// Auth middleware applies to all /v1/* routes only.
// /health remains publicly accessible.
app.use('/v1/*', authMiddleware);

registerHealthRoute(app);
registerMeRoute(app);
registerSessionsRoute(app);
registerSettingsRoute(app);

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
