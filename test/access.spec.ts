import { setupNetwork } from '@msw/cloudflare';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index';
import { unreachableAi } from './workers-ai';

const ENV = {
	DEBUG: 'false',
	TEAM_NAME: 'creator',
	POLICY_AUD: 'test-policy-aud',
	AI_GATEWAY: '',
	AI: unreachableAi(),
} satisfies Env;

const TEAM_DOMAIN = `https://${ENV.TEAM_NAME}.cloudflareaccess.com`;

// Access signs its assertions with RS256 and publishes the public half at its
// certs endpoint. Standing in for that endpoint is what lets the guard run the
// key fetching it really does, rather than a seam opened for the test.
const ALGORITHM = 'RS256';
const KEY_ID = 'test-key';

const network = setupNetwork();
let privateKey: CryptoKey;

beforeAll(async () => {
	const keys = await generateKeyPair(ALGORITHM, { extractable: true });
	privateKey = keys.privateKey;

	const jwk = await exportJWK(keys.publicKey);
	network.use(
		http.get(`${TEAM_DOMAIN}/cdn-cgi/access/certs`, () => HttpResponse.json({ keys: [{ ...jwk, alg: ALGORITHM, kid: KEY_ID }] })),
	);
	network.enable();
});

afterAll(() => network.disable());

const assertionFrom = ({ issuer = TEAM_DOMAIN, audience = ENV.POLICY_AUD } = {}) =>
	new SignJWT({})
		.setProtectedHeader({ alg: ALGORITHM, kid: KEY_ID })
		.setIssuer(issuer)
		.setAudience(audience)
		.setExpirationTime('1h')
		.sign(privateKey);

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
	it('should refuse the request when no assertion is carried', async () => {
		const response = await app.request('/mcp', ping(), ENV);

		expect(response.status).toBe(401);
	});

	// @behavior A-002
	it('should answer the request when the assertion is for this application', async () => {
		const assertion = await assertionFrom();

		const response = await app.request('/mcp', ping({ 'cf-access-jwt-assertion': assertion }), ENV);

		expect(response.status).toBe(200);
	});

	// @behavior A-003
	it('should refuse the request when the assertion is for another application', async () => {
		const assertion = await assertionFrom({ audience: 'another-application' });

		const response = await app.request('/mcp', ping({ 'cf-access-jwt-assertion': assertion }), ENV);

		expect(response.status).toBe(401);
	});

	// @behavior A-005
	it('should refuse the request when the assertion is from another team domain', async () => {
		const assertion = await assertionFrom({ issuer: 'https://elsewhere.cloudflareaccess.com' });

		const response = await app.request('/mcp', ping({ 'cf-access-jwt-assertion': assertion }), ENV);

		expect(response.status).toBe(401);
	});

	// @behavior A-004
	it('should answer the request without an assertion when DEBUG is on', async () => {
		const response = await app.request('/mcp', ping(), { ...ENV, DEBUG: 'true' });

		expect(response.status).toBe(200);
	});
});
