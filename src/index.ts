import { createMcpHandler, McpServer, originValidationResponse } from '@modelcontextprotocol/server';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { name, version } from '../package.json';
import { accessGuard, accessOf } from './access';
import { registerCreateAudio } from './audio';
import { backupFor } from './backup';
import { guideNamed, registerReadGuide } from './guide';
import { registerCreateImage } from './image';
import { runModel } from './proxy';

const gatewayFor = ({ AI_GATEWAY }: Env): AiOptions | undefined => (AI_GATEWAY ? { gateway: { id: AI_GATEWAY } } : undefined);

// The tools serve with the bindings of the request they answer and with who
// Access resolved it to be, and the route is the only place either is in hand:
// what a Worker reaches from module scope is its own env rather than the one a
// caller handed the app, and the match lands on the context the runtime passes.
// Building the handler here instead costs well under a microsecond and keeps
// nothing between requests, which is what lets this Worker serve MCP without a
// Durable Object.
// Not every client hands these to its model, so they repeat what the tools
// already say rather than carry anything only they would.
const INSTRUCTIONS =
	'Generates images and speech with Workers AI. Each tool describes what every call needs; ' +
	'how to use them beyond that is in the guides, which read_guide lists and reads.';

const handlerFor = (env: Env, executionCtx: unknown) =>
	createMcpHandler(() => {
		const server = new McpServer({ name, version }, { instructions: INSTRUCTIONS });
		const gateway = gatewayFor(env);
		const backup = backupFor(env, accessOf(executionCtx));
		registerCreateImage(server, env.AI, backup, gateway);
		registerCreateAudio(server, env.AI, backup, gateway);
		registerReadGuide(server);

		return server;
	});

// No browser is a legitimate caller here, so no origin is allowed. A client
// that sends none — every agent — still passes; one that sends any is a page
// acting on a visitor's Access session rather than the visitor's agent.
const ALLOWED_ORIGINS: string[] = [];

// The same holds under `/api`, which answers in its own words rather than the
// protocol's, so the refusal is plain rather than a JSON-RPC error.
const refusingBrowsers = createMiddleware(async (c, next) => (c.req.header('origin') ? c.text('Forbidden', 403) : next()));

const app = new Hono<{ Bindings: Env }>();

// @route GET /
// Reachable without a check of its own: Access guards the Worker, and a
// placeholder is all that is behind it until a dashboard is.
app.get('/', (c) => c.text('Coming Soon'));

app.use('/mcp', accessGuard);
app.use('/api/*', accessGuard, refusingBrowsers);

// @route GET /api
app.get('/api', (c) => c.body(guideNamed('api'), 200, { 'content-type': 'text/markdown; charset=utf-8' }));

// A model's id carries slashes of its own, so the parameter takes the rest of the path.
// @route POST /api/ai/run/{model}
app.post('/api/ai/run/:model{.+}', (c) => runModel(c.env.AI, c.req.param('model'), c.req.raw, gatewayFor(c.env)));

// @route ALL /mcp
app.all('/mcp', (c) => originValidationResponse(c.req.raw, ALLOWED_ORIGINS) ?? handlerFor(c.env, c.executionCtx).fetch(c.req.raw));

export default app;
