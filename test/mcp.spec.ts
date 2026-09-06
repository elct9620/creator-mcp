import { exports } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';

// The endpoint answers a single exchange as one server-sent event, so the
// JSON-RPC payload is the `data:` line of that event.
const jsonRpcPayload = (body: string): unknown =>
	JSON.parse(
		body
			.split('\n')
			.find((line) => line.startsWith('data:'))!
			.slice('data:'.length),
	);

const callMcp = (method: string) =>
	exports.default.fetch('https://creator.example.com/mcp', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} }),
	});

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
