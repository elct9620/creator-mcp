import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index';
import { unreachableAi } from './workers-ai';

// What Access admits is settled in its own feature; this one asks what the
// endpoint answers once a caller is through.
const ENV = {
	DEBUG: 'true',
	TEAM_NAME: 'creator',
	POLICY_AUD: 'test-policy-aud',
	AI: unreachableAi(),
} satisfies Env;

// The transport never dials this URL: every request it makes is served by the
// same app the Worker exports, so the protocol is exercised over the real
// routing rather than over a hand-written JSON-RPC envelope.
const ENDPOINT = new URL('https://creator.example.com/mcp');

const client = new Client({ name: 'test-harness', version: '0.0.0' });

beforeAll(async () => {
	await client.connect(
		new StreamableHTTPClientTransport(ENDPOINT, {
			fetch: async (url, init) => app.fetch(new Request(url, init), ENV),
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
	it('should carry no tools of its own yet', async () => {
		const { tools } = await client.listTools();

		expect(tools).toEqual([]);
	});
});
