import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors.js';

const app = new Hono();

app.use('*', corsMiddleware);

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

export default app;
