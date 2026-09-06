import { createMcpHandler, McpServer, originValidationResponse } from '@modelcontextprotocol/server';
import { Hono } from 'hono';
import { name, version } from '../package.json';
import { accessGuard } from './access';
import { registerCreateImage } from './image';

const gatewayFor = ({ AI_GATEWAY }: Env): AiOptions | undefined => (AI_GATEWAY ? { gateway: { id: AI_GATEWAY } } : undefined);

// The tools serve with the bindings of the request they answer, and the route
// is the only place those are in hand: what a Worker reaches from module scope
// is its own env rather than the one a caller handed the app. Building the
// handler here instead costs well under a microsecond and keeps nothing
// between requests, which is what lets this Worker serve MCP without a
// Durable Object.
const handlerFor = (env: Env) =>
	createMcpHandler(() => {
		const server = new McpServer({ name, version });
		registerCreateImage(server, env.AI, gatewayFor(env));

		return server;
	});

// No browser is a legitimate caller here, so no origin is allowed. A client
// that sends none — every agent — still passes; one that sends any is a page
// acting on a visitor's Access session rather than the visitor's agent.
const ALLOWED_ORIGINS: string[] = [];

const app = new Hono<{ Bindings: Env }>();

// @route GET /
// Reachable without a check of its own: Access guards the Worker, and a
// placeholder is all that is behind it until a dashboard is.
app.get('/', (c) => c.text('Coming Soon'));

app.use('/mcp', accessGuard);

// @route ALL /mcp
app.all('/mcp', (c) => originValidationResponse(c.req.raw, ALLOWED_ORIGINS) ?? handlerFor(c.env).fetch(c.req.raw));

export default app;
