import { describe, it, expect } from 'vitest';
import app from '../src/index';

// The endpoint answers a single exchange as one server-sent event, so the
// JSON-RPC payload is the `data:` line of that event.
const jsonRpcPayload = (body: string): unknown =>
	JSON.parse(
		body
			.split('\n')
			.find((line) => line.startsWith('data:'))!
			.slice('data:'.length),
	);

// What Access admits is settled in its own feature; this one asks what the
// endpoint answers once a caller is through.
const ENV = {
	DEBUG: 'true',
	TEAM_DOMAIN: 'https://creator.cloudflareaccess.com',
	POLICY_AUD: 'test-policy-aud',
} satisfies Env;

const callMcp = (method: string) =>
	app.request(
		'/mcp',
		{
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json, text/event-stream',
			},
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} }),
		},
		ENV,
	);

describe('MCP endpoint', () => {
	// @behavior M-001
	it('should answer an empty result when ping is requested', async () => {
		const response = await callMcp('ping');

		expect(jsonRpcPayload(await response.text())).toEqual({
			jsonrpc: '2.0',
			id: 1,
			result: {},
		});
	});
});
