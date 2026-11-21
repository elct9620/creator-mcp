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

	// Both routes under `/api`: the guide and the proxy sit behind the same guard.
	// @behavior A-003
	it.each([
		['GET', 'https://creator.example.com/api'],
		['POST', 'https://creator.example.com/api/ai/run/openai/gpt-image-2.5-flare'],
	])('should refuse %s %s when Access never matched it', async (method, url) => {
		const response = await exports.default.fetch(new Request(url, { method, body: method === 'POST' ? '{}' : undefined }));

		expect(response.status).toBe(401);
	});

	// @behavior A-002
	it('should answer the request when Access matched it', async () => {
		const response = await exports.default.fetch(asMatched(new Request(ENDPOINT, ping())));

		expect(response.status).toBe(200);
	});
});
