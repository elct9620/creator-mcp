import { createMcpHandler, McpServer, originValidationResponse, type McpHttpHandler } from '@modelcontextprotocol/server';
import { Hono } from 'hono';
import { name, version } from '../package.json';
import { accessGuard } from './access';
import { registerCreateImage } from './image';

// The server is built per request and keeps nothing between them, which is
// what lets this Worker serve MCP without a Durable Object. The handler around
// it is not per request — it holds the subscription bus and the exchanges
// still in flight — so it is kept for as long as the bindings it was built
// against. A Worker has one env, and so one handler; handing the app another
// env is what lets a caller serve the endpoint against bindings of its own.
const handlers = new WeakMap<Env, McpHttpHandler>();

const handlerFor = (env: Env) => {
	let handler = handlers.get(env);
	if (!handler) {
		handler = createMcpHandler(() => {
			const server = new McpServer({ name, version });
			registerCreateImage(server, env.AI);

			return server;
		});
		handlers.set(env, handler);
	}
	return handler;
};

// No browser is a legitimate caller here, so no origin is allowed. A client
// that sends none — every agent — still passes; one that sends any is a page
// acting on a visitor's Access session rather than the visitor's agent.
const ALLOWED_ORIGINS: string[] = [];

const app = new Hono<{ Bindings: Env }>();

// @route GET /
// Reachable without an assertion: Access guards this at the edge, and a
// placeholder is all that is behind it until a dashboard is.
app.get('/', (c) => c.text('Coming Soon'));

app.use('/mcp', accessGuard());

// @route ALL /mcp
app.all('/mcp', (c) => originValidationResponse(c.req.raw, ALLOWED_ORIGINS) ?? handlerFor(c.env).fetch(c.req.raw));

export default app;
