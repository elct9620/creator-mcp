import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { setupNetwork } from '@msw/cloudflare';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import app from '../src/index';
import { arrivingMatched } from './access';
import { aiAnswering, type Generation } from './workers-ai';

// A link of the shape Workers AI really answers with: a presigned R2 URL whose
// signature and expiry ride in the query, and whose path carries no hint of
// what it holds. The tool hands it on without reading anything into it.
const IMAGE_PATH = 'https://ai-gateway-outputs.example.r2.cloudflarestorage.com/provider-outputs/stand-in/stand-in';
const IMAGE = `${IMAGE_PATH}?X-Amz-Expires=86400&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=stand-in`;

// Standing in for the store the link points at. It is asked for one byte, and
// what it answers with is the encoding the reply reports.
const network = setupNetwork();

// What the store was asked for, so a test can say that the image was left
// where it is rather than pulled through the Worker.
let ranges: (string | null)[] = [];

const storeHolding = (contentType: string) =>
	http.get(IMAGE_PATH, ({ request }) => {
		ranges.push(request.headers.get('range'));

		return new HttpResponse(null, { status: 206, headers: { 'content-type': contentType } });
	});

const storeRefusing = () => http.get(IMAGE_PATH, () => new HttpResponse(null, { status: 403 }));

// The gateway wraps the model's output; `gatewayMetadata` rides along on some
// answers and not others, which is why nothing but the link is read.
const answering = (image: string) => ({ state: 'Completed', result: { image } });

const ENDPOINT = new URL('https://creator.example.com/mcp');

// Access is settled in its own feature; every caller here arrives matched.
const envWith = (ai: Ai, AI_GATEWAY = ''): Env => ({ AI_GATEWAY, AI: ai });

const connect = async (env: Env) => {
	const client = new Client({ name: 'test-harness', version: '0.0.0' });
	await client.connect(
		new StreamableHTTPClientTransport(ENDPOINT, {
			fetch: async (url, init) => app.fetch(new Request(url, init), env, arrivingMatched()),
		}),
	);

	return client;
};

let client: Client;
let generations: Generation[];

beforeAll(() => network.enable());
afterAll(() => network.disable());

beforeEach(async () => {
	ranges = [];
	network.resetHandlers(storeHolding('image/jpeg'));

	const workersAi = aiAnswering(answering(IMAGE));
	generations = workersAi.generations;
	client = await connect(envWith(workersAi.ai));
});

afterEach(() => client.close());

const createImage = (args: Record<string, unknown>) => client.callTool({ name: 'create_image', arguments: args });

describe('image generation', () => {
	// @behavior I-001
	it('should offer the tool when a client lists them', async () => {
		const { tools } = await client.listTools();

		expect(tools.map(({ name }) => name)).toContain('create_image');
	});

	// @behavior I-002
	it('should generate from the prompt when the tool is called', async () => {
		await createImage({ prompt: 'a red bicycle' });

		expect(generations[0].inputs).toMatchObject({ prompt: 'a red bicycle' });
	});

	// @behavior I-003
	it('should generate with nano-banana-pro when no model is named', async () => {
		await createImage({ prompt: 'a red bicycle' });

		expect(generations[0].model).toBe('google/nano-banana-pro');
	});

	// @behavior I-004
	it('should pass the generation options on when the caller gives them', async () => {
		await createImage({
			prompt: 'a red bicycle',
			aspect_ratio: '16:9',
			output_format: 'webp',
			image_size: '2K',
		});

		expect(generations[0].inputs).toMatchObject({
			aspect_ratio: '16:9',
			output_format: 'webp',
			image_size: '2K',
		});
	});

	// @behavior I-005
	it('should carry the link as given when the model answers', async () => {
		const { content } = await createImage({ prompt: 'a red bicycle' });

		expect(content).toEqual([expect.objectContaining({ type: 'resource_link', uri: IMAGE })]);
	});

	// @behavior I-006
	it('should state what the store holds when the caller asked for something else', async () => {
		const { content } = await createImage({ prompt: 'a red bicycle', output_format: 'png' });

		expect(content).toEqual([expect.objectContaining({ mimeType: 'image/jpeg' })]);
	});

	// @behavior I-007
	it('should state the format the caller asked for when the store will not say', async () => {
		network.resetHandlers(storeRefusing());

		const { content } = await createImage({ prompt: 'a red bicycle', output_format: 'webp' });

		expect(content).toEqual([expect.objectContaining({ mimeType: 'image/webp' })]);
	});

	// @behavior I-007
	it('should state the format the caller asked for when the store cannot be reached', async () => {
		network.resetHandlers(http.get(IMAGE_PATH, () => HttpResponse.error()));

		const { content } = await createImage({ prompt: 'a red bicycle', output_format: 'webp' });

		expect(content).toEqual([expect.objectContaining({ mimeType: 'image/webp' })]);
	});

	// @behavior I-008
	it('should fail when the model answers without a link', async () => {
		const stranded = await connect(envWith(aiAnswering({ state: 'Completed', result: {} }).ai));

		const result = await stranded.callTool({ name: 'create_image', arguments: { prompt: 'a red bicycle' } });

		expect(result.isError).toBe(true);
		await stranded.close();
	});

	// @behavior I-009
	it('should state no encoding when neither the store nor the caller gives one', async () => {
		network.resetHandlers(storeRefusing());

		const { content } = await createImage({ prompt: 'a red bicycle' });

		expect(content).toEqual([expect.not.objectContaining({ mimeType: expect.anything() })]);
	});

	// @behavior I-010
	it('should ask the store for a single byte when it asks what the image is', async () => {
		await createImage({ prompt: 'a red bicycle' });

		expect(ranges).toEqual(['bytes=0-0']);
	});

	// @behavior I-011
	it('should reach the model through the gateway when a deployment names one', async () => {
		const workersAi = aiAnswering(answering(IMAGE));
		const routed = await connect(envWith(workersAi.ai, 'hibi'));

		await routed.callTool({ name: 'create_image', arguments: { prompt: 'a red bicycle' } });

		expect(workersAi.generations[0].options).toMatchObject({ gateway: { id: 'hibi' } });
		await routed.close();
	});

	// @behavior I-012
	it('should reach the model directly when a deployment names no gateway', async () => {
		await createImage({ prompt: 'a red bicycle' });

		expect(generations[0].options?.gateway).toBeUndefined();
	});
});
