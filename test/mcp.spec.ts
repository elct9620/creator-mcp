import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { env, exports } from 'cloudflare:workers';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { asMatched } from './access';
import { unreachableAi } from './workers-ai';

// The transport never dials this URL: every request it makes is served by the
// Worker itself, so the protocol is exercised over the real routing rather
// than over a hand-written JSON-RPC envelope.
const ENDPOINT = new URL('https://creator.example.com/mcp');

const client = new Client({ name: 'test-harness', version: '0.0.0' });

beforeAll(async () => {
	// Nothing here reaches the model, and no test may hold a binding that could.
	Object.assign(env, { AI: unreachableAi() });

	await client.connect(
		new StreamableHTTPClientTransport(ENDPOINT, {
			// What Access admits is settled in its own feature; this one asks
			// what the endpoint answers once a caller is through.
			fetch: async (url, init) => exports.default.fetch(asMatched(new Request(url, init))),
		}),
	);
});

afterAll(() => client.close());

describe('MCP endpoint', () => {
	// @behavior M-001
	it('should answer a ping', async () => {
		await expect(client.ping()).resolves.toEqual({});
	});

	// @behavior M-002
	it('should point to the guides in its instructions', () => {
		expect(client.getInstructions()).toContain('read_guide');
	});
});
