import { env, exports } from 'cloudflare:workers';
import { describe, it, expect, beforeEach } from 'vitest';
import { asMatched } from './access';
import { aiAnswering, unreachableAi } from './workers-ai';

const MODEL = 'openai/gpt-image-2.5-flare';

const ENDPOINT = `https://creator.example.com/api/ai/run/${MODEL}`;

const SCHEMA = `https://developers.cloudflare.com/ai/models/${MODEL}/schema-input.json`;

// A body of the shape the model documents for an edit: nothing here reads it,
// so it stands for any payload a caller writes.
const EDIT = { prompt: 'Make the sky purple', images: ['data:image/png;base64,c3RhbmQtaW4='] };

const ANSWER = { state: 'Completed', result: { image: 'https://ai-gateway-outputs.example.com/stand-in' } };

const post = (body: string, headers: Record<string, string> = {}) =>
	exports.default.fetch(
		asMatched(new Request(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body })),
	);

const failingWith = (message: string) => ({ run: () => Promise.reject(new Error(message)) }) as unknown as Ai;

// Each test states the deployment it is about; a `.dev.vars` on the machine
// running the suite would otherwise name a gateway nobody asked for here.
beforeEach(() => {
	Object.assign(env, { AI: unreachableAi(), AI_GATEWAY: undefined });
});

describe('Proxy', () => {
	// @behavior P-001
	it('should run the model the path names with the body unchanged', async () => {
		const workersAi = aiAnswering(ANSWER);
		Object.assign(env, { AI: workersAi.ai });

		await post(JSON.stringify(EDIT));

		expect(workersAi.generations).toStrictEqual([{ model: MODEL, inputs: EDIT, options: undefined }]);
	});

	// A Workers AI model's id carries an `@` and a slash more than a partner's.
	// @behavior P-001
	it('should run a model whose id opens with @cf', async () => {
		const workersAi = aiAnswering(ANSWER);
		Object.assign(env, { AI: workersAi.ai });

		await exports.default.fetch(
			asMatched(
				new Request('https://creator.example.com/api/ai/run/@cf/black-forest-labs/flux-1-schnell', {
					method: 'POST',
					body: JSON.stringify({ prompt: 'a fox' }),
				}),
			),
		);

		expect(workersAi.generations[0].model).toBe('@cf/black-forest-labs/flux-1-schnell');
	});

	// @behavior P-002
	it('should reach the model through the gateway a deployment names', async () => {
		const workersAi = aiAnswering(ANSWER);
		Object.assign(env, { AI: workersAi.ai, AI_GATEWAY: 'hibi' });

		await post(JSON.stringify(EDIT));

		expect(workersAi.generations[0].options).toStrictEqual({ gateway: { id: 'hibi' } });
	});

	// @behavior P-003
	it('should answer with the record the model answered, as JSON', async () => {
		Object.assign(env, { AI: aiAnswering(ANSWER).ai });

		const response = await post(JSON.stringify(EDIT));

		expect(response.status).toBe(200);
		expect(await response.json()).toStrictEqual(ANSWER);
	});

	// @behavior P-004
	it('should answer with the bytes of a stream the model answered', async () => {
		const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04]);
		Object.assign(env, { AI: { run: () => Promise.resolve(new Blob([bytes]).stream()) } as unknown as Ai });

		const response = await post(JSON.stringify({ text: 'hello' }));

		expect(new Uint8Array(await response.arrayBuffer())).toStrictEqual(bytes);
	});

	// @behavior P-005
	it.each([
		['is not JSON', 'prompt=a fox'],
		['is a JSON array', '[1, 2]'],
		['is a JSON string', '"a fox"'],
	])('should answer 400 when the body %s', async (_, body) => {
		const response = await post(body);

		expect(response.status).toBe(400);
	});

	// The AI stands in as unreachable, so a call reaching it throws and the
	// response would be 502 instead.
	// @behavior P-006
	it('should run no model when the body is no JSON object', async () => {
		const workersAi = aiAnswering(ANSWER);
		Object.assign(env, { AI: workersAi.ai });

		await post('[1, 2]');

		expect(workersAi.generations).toStrictEqual([]);
	});

	// @behavior P-007
	it('should answer 502 carrying the message the model failed with', async () => {
		Object.assign(env, { AI: failingWith('AiGatewayError: 7003: User Input Error') });

		const response = await post(JSON.stringify(EDIT));

		expect(response.status).toBe(502);
		expect(await response.text()).toContain('AiGatewayError: 7003: User Input Error');
	});

	// @behavior P-008
	it('should name the model input schema and GET /api when the model fails', async () => {
		Object.assign(env, { AI: failingWith('AiGatewayError: 7003: User Input Error') });

		const text = await (await post(JSON.stringify(EDIT))).text();

		expect(text).toContain(SCHEMA);
		expect(text).toContain('GET /api');
	});

	// @behavior P-009
	it('should refuse a request naming an origin', async () => {
		const response = await post(JSON.stringify(EDIT), { origin: 'https://page.example.com' });

		expect(response.status).toBe(403);
	});

	// @behavior P-010
	it('should answer with the api guide as Markdown', async () => {
		const response = await exports.default.fetch(asMatched(new Request('https://creator.example.com/api')));

		expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
		expect(await response.text()).toMatch(/^# Running a model with your own payload\n/);
	});
});
