import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/index';

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
const callMcp = async (method: string) => {
	const request = new Request('https://creator.example.com/mcp', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} }),
	});
	const ctx = createExecutionContext();
	const response = await createApp().fetch(request, { ...env, DEBUG: 'true' }, ctx);
	await waitOnExecutionContext(ctx);
	return response;
};

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
