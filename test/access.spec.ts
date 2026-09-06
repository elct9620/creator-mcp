import { exports } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';
import { asMatched } from './access';

const ENDPOINT = 'https://creator.example.com/mcp';

const ping = () =>
	({
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} }),
	}) satisfies RequestInit;

describe('Access', () => {
	// @behavior A-001
	it('should refuse the request when Access never matched it', async () => {
		const response = await exports.default.fetch(new Request(ENDPOINT, ping()));

		expect(response.status).toBe(401);
	});

	// @behavior A-002
	it('should answer the request when Access matched it', async () => {
		const response = await exports.default.fetch(asMatched(new Request(ENDPOINT, ping())));

		expect(response.status).toBe(200);
	});
});
