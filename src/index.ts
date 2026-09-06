import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { Hono } from 'hono';

// The factory runs per request and the handler keeps nothing between them,
// which is what lets this Worker serve MCP without a Durable Object.
const mcp = createMcpHandler(() => new McpServer({ name: 'creator-mcp', version: '0.0.0' }));

const app = new Hono<{ Bindings: Env }>();

// @route GET /
app.get('/', (c) => c.text('Coming Soon'));

// @route ALL /mcp
app.all('/mcp', (c) => mcp.fetch(c.req.raw));

export default app;
