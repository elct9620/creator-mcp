import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

// @route GET /
app.get('/', (c) => c.text('Coming Soon'));

export default app;
