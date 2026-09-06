import { describe, it, expect } from 'vitest';
import app from '../src/index';
import { arrivingMatched, arrivingUnmatched } from './access';
import { unreachableAi } from './workers-ai';

const ENV = { AI_GATEWAY: '', AI: unreachableAi() } satisfies Env;

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
		const response = await app.request('/mcp', ping(), ENV, arrivingUnmatched());

		expect(response.status).toBe(401);
	});

	// @behavior A-002
	it('should answer the request when Access matched it', async () => {
		const response = await app.request('/mcp', ping(), ENV, arrivingMatched());

		expect(response.status).toBe(200);
	});
});
