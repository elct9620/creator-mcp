import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { SignJWT, generateKeyPair } from 'jose';
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/index';

// Access signs its assertions with RS256. Signing with a locally generated key
// and handing the guard its public half is what lets a valid assertion be
// exercised without reaching Cloudflare for one.
const ALGORITHM = 'RS256';

let keys: Awaited<ReturnType<typeof generateKeyPair>>;

beforeAll(async () => {
	keys = await generateKeyPair(ALGORITHM);
});

const assertionFor = (audience: string) =>
	new SignJWT({})
		.setProtectedHeader({ alg: ALGORITHM })
		.setIssuer(env.TEAM_DOMAIN)
		.setAudience(audience)
		.setExpirationTime('1h')
		.sign(keys.privateKey);

const ping = (headers: Record<string, string> = {}) =>
	new Request('https://creator.example.com/mcp', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
			...headers,
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} }),
	});

const serve = async (request: Request, overrides: Partial<Env> = {}) => {
	const app = createApp(() => keys.publicKey);
	const ctx = createExecutionContext();
	const response = await app.fetch(request, { ...env, ...overrides }, ctx);
	await waitOnExecutionContext(ctx);
	return response;
};

describe('Access', () => {
	// @behavior A-001
	it('should refuse the request when no assertion is carried', async () => {
		const response = await exports.default.fetch(ping());

		expect(response.status).toBe(401);
	});

	// @behavior A-002
	it('should answer the request when the assertion is for this application', async () => {
		const response = await serve(ping({ 'Cf-Access-Jwt-Assertion': await assertionFor(env.POLICY_AUD) }));

		expect(response.status).toBe(200);
	});

	// @behavior A-003
	it('should refuse the request when the assertion is for another application', async () => {
		const response = await serve(ping({ 'Cf-Access-Jwt-Assertion': await assertionFor('another-application') }));

		expect(response.status).toBe(401);
	});

	// @behavior A-004
	it('should answer the request without an assertion when DEBUG is on', async () => {
		const response = await serve(ping(), { DEBUG: 'true' });

		expect(response.status).toBe(200);
	});
});
