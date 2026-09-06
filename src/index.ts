import { createMcpHandler, McpServer, originValidationResponse } from '@modelcontextprotocol/server';
import { Hono } from 'hono';
import { accessGuard, type KeySource } from './access';

// The factory runs per request and the handler keeps nothing between them,
// which is what lets this Worker serve MCP without a Durable Object.
const mcp = createMcpHandler(() => new McpServer({ name: 'creator-mcp', version: '0.0.0' }));

// No browser is a legitimate caller here, so no origin is allowed. A client
// that sends none — every agent — still passes; one that sends any is a page
// acting on a visitor's Access session rather than the visitor's agent.
const ALLOWED_ORIGINS: string[] = [];

export const createApp = (keySource?: KeySource) => {
	const app = new Hono<{ Bindings: Env }>();

	// @route GET /
	// Reachable without an assertion: Access guards this at the edge, and a
	// placeholder is all that is behind it until a dashboard is.
	app.get('/', (c) => c.text('Coming Soon'));

	app.use('/mcp', accessGuard(keySource));

	// @route ALL /mcp
	app.all('/mcp', (c) => originValidationResponse(c.req.raw, ALLOWED_ORIGINS) ?? mcp.fetch(c.req.raw));

	return app;
};

export default createApp();
