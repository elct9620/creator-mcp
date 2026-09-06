import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { matchedHeaders } from './access';

const ENDPOINT = 'https://creator.example.com/mcp';

const ping = (headers: Record<string, string> = {}) =>
	({
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
			...headers,
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} }),
	}) satisfies RequestInit;

describe('Access', () => {
	// @behavior A-001
	it('should refuse the request when Access never matched it', async () => {
		const response = await SELF.fetch(ENDPOINT, ping());

		expect(response.status).toBe(401);
	});

	// @behavior A-002
	it('should answer the request when Access matched it', async () => {
		const response = await SELF.fetch(ENDPOINT, ping(matchedHeaders()));

		expect(response.status).toBe(200);
	});
});
