import { OpenAPIHono } from '@hono/zod-openapi';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { registerHealthRoute } from './routes/health.js';

const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: 'Validation failed', details: result.error.flatten() }, 422);
    }
  },
});

app.use('*', corsMiddleware);
app.onError(errorHandler);

registerHealthRoute(app);

export default app;
