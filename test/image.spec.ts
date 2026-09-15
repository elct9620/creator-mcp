import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { setupNetwork } from '@msw/cloudflare';
import { env, exports } from 'cloudflare:workers';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { asMatched } from './access';
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

// A binding assigned here is what the Worker answers with, so every client
// states the model and gateway its own test is about. Whatever the last one
// set stays until the next one says otherwise, which is why both are named
// every time rather than only the one under test. A deployment names a gateway
// by setting a secret, so naming none here leaves the binding undefined.
const connect = async (ai: Ai, AI_GATEWAY?: string) => {
	Object.assign(env, { AI: ai, AI_GATEWAY });

	const client = new Client({ name: 'test-harness', version: '0.0.0' });
	await client.connect(
		new StreamableHTTPClientTransport(ENDPOINT, {
			// Access is settled in its own feature; every caller here arrives matched.
			fetch: async (url, init) => exports.default.fetch(asMatched(new Request(url, init))),
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
	client = await connect(workersAi.ai);
});

afterEach(() => client.close());

const createImage = (args: Record<string, unknown>) => client.callTool({ name: 'create_image', arguments: args });

type Content = Awaited<ReturnType<Client['callTool']>>['content'];

// A promise about the link or the text is a promise about that block, not about
// where in the reply it sits.
const linkIn = (content: Content) => content?.find(({ type }) => type === 'resource_link');
const textIn = (content: Content) => content?.find(({ type }) => type === 'text');

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
	it('should generate with nano-banana-2 when no model is named', async () => {
		await createImage({ prompt: 'a red bicycle' });

		expect(generations[0].model).toBe('google/nano-banana-2');
	});

	// The caller says `aspect_ratio`, `format` and `resolution` whichever model
	// generates; each model is asked in its own words. `google/nano-banana-pro`
	// calls the resolution something else, and a GPT Image model is asked for a
	// size in pixels and for `jpeg`, so the cases together are what watches the
	// translation rather than a single spelling. An exact match rather than a
	// subset: a key the model never asked for is as wrong as a key under the
	// wrong name, which is why one case names no shape and the GPT Image models
	// are sent no resolution.
	// @behavior I-004
	it.each([
		[
			'google/nano-banana-pro',
			{ aspect_ratio: '16:9', format: 'webp', resolution: '2K' },
			{ aspect_ratio: '16:9', output_format: 'webp', image_size: '2K' },
		],
		[
			'google/nano-banana-2',
			{ aspect_ratio: '16:9', format: 'png', resolution: '2K' },
			{ aspect_ratio: '16:9', output_format: 'png', resolution: '2K' },
		],
		['google/nano-banana-2-lite', { format: 'jpg', resolution: '1K' }, { output_format: 'jpg', resolution: '1K' }],
		[
			'openai/gpt-image-2.5-flare',
			{ aspect_ratio: '3:2', format: 'jpg', resolution: '1K', quality: 'high', background: 'opaque' },
			{ size: '1536x1024', output_format: 'jpeg', quality: 'high', background: 'opaque' },
		],
		[
			'openai/gpt-image-2.5-sunburst',
			{ aspect_ratio: '2:3', format: 'webp', quality: 'max', background: 'transparent' },
			{ size: '1024x1536', output_format: 'webp', quality: 'max', background: 'transparent' },
		],
	])('should ask %s in its own words when the caller gives generation options', async (model, asked, expected) => {
		await createImage({ prompt: 'a red bicycle', model, ...asked });

		expect(generations[0].inputs).toStrictEqual({ prompt: 'a red bicycle', ...expected });
	});

	// @behavior I-005
	it('should carry the link as given when the model answers', async () => {
		const { content } = await createImage({ prompt: 'a red bicycle' });

		expect(linkIn(content)).toMatchObject({ type: 'resource_link', uri: IMAGE });
	});

	// @behavior I-006
	it('should state what the store holds when the caller asked for something else', async () => {
		const { content } = await createImage({ prompt: 'a red bicycle', format: 'png' });

		expect(linkIn(content)).toMatchObject({ mimeType: 'image/jpeg' });
	});

	// webp is the encoding only `google/nano-banana-pro` stores, which is why
	// these two name it: the promise is about the fallback, not about the model.
	// @behavior I-007
	it('should state the format the caller asked for when the store will not say', async () => {
		network.resetHandlers(storeRefusing());

		const { content } = await createImage({ prompt: 'a red bicycle', model: 'google/nano-banana-pro', format: 'webp' });

		expect(linkIn(content)).toMatchObject({ mimeType: 'image/webp' });
	});

	// @behavior I-007
	it('should state the format the caller asked for when the store cannot be reached', async () => {
		network.resetHandlers(http.get(IMAGE_PATH, () => HttpResponse.error()));

		const { content } = await createImage({ prompt: 'a red bicycle', model: 'google/nano-banana-pro', format: 'webp' });

		expect(linkIn(content)).toMatchObject({ mimeType: 'image/webp' });
	});

	// @behavior I-008
	it('should fail when the model answers without a link', async () => {
		const stranded = await connect(aiAnswering({ state: 'Completed', result: {} }).ai);

		const result = await stranded.callTool({ name: 'create_image', arguments: { prompt: 'a red bicycle' } });

		expect(result.isError).toBe(true);
		await stranded.close();
	});

	// @behavior I-009
	it('should state no encoding when neither the store nor the caller gives one', async () => {
		network.resetHandlers(storeRefusing());

		const { content } = await createImage({ prompt: 'a red bicycle' });

		expect(linkIn(content)).not.toHaveProperty('mimeType');
	});

	// @behavior I-010
	it('should ask the store for a single byte when it asks what the image is', async () => {
		await createImage({ prompt: 'a red bicycle' });

		expect(ranges).toEqual(['bytes=0-0']);
	});

	// @behavior I-011
	it('should reach the model through the gateway when a deployment names one', async () => {
		const workersAi = aiAnswering(answering(IMAGE));
		const routed = await connect(workersAi.ai, 'hibi');

		await routed.callTool({ name: 'create_image', arguments: { prompt: 'a red bicycle' } });

		expect(workersAi.generations[0].options).toMatchObject({ gateway: { id: 'hibi' } });
		await routed.close();
	});

	// A secret nobody set and a secret set to nothing are both a deployment
	// naming no gateway, and an empty name is the one the model refuses.
	// @behavior I-012
	it.each([
		['no secret is set', undefined],
		['the secret is empty', ''],
	])('should reach the model directly when %s', async (_, AI_GATEWAY) => {
		const workersAi = aiAnswering(answering(IMAGE));
		const direct = await connect(workersAi.ai, AI_GATEWAY);

		await direct.callTool({ name: 'create_image', arguments: { prompt: 'a red bicycle' } });

		expect(workersAi.generations[0].options?.gateway).toBeUndefined();
		await direct.close();
	});

	// @behavior I-013
	it('should carry the link and its encoding as structured content when the model answers', async () => {
		const { structuredContent } = await createImage({ prompt: 'a red bicycle' });

		expect(structuredContent).toStrictEqual({ uri: IMAGE, mime_type: 'image/jpeg' });
	});

	// @behavior I-014
	it('should state no encoding in the structured content when neither the store nor the caller gives one', async () => {
		network.resetHandlers(storeRefusing());

		const { structuredContent } = await createImage({ prompt: 'a red bicycle' });

		expect(structuredContent).toStrictEqual({ uri: IMAGE });
	});

	// @behavior I-015
	it('should state the shape of its reply when a client lists the tools', async () => {
		const { tools } = await client.listTools();

		expect(tools.find(({ name }) => name === 'create_image')?.outputSchema).toMatchObject({
			properties: { uri: { type: 'string' }, mime_type: { type: 'string' } },
			required: ['uri'],
		});
	});

	// @behavior I-016
	it('should state the link in text when the model answers', async () => {
		const { content } = await createImage({ prompt: 'a red bicycle' });

		expect(textIn(content)).toMatchObject({ text: expect.stringContaining(IMAGE) });
	});

	// @behavior I-016
	it('should say how long the link stands when it states it in text', async () => {
		const { content } = await createImage({ prompt: 'a red bicycle' });

		expect(textIn(content)).toMatchObject({ text: expect.stringMatching(/about a day/) });
	});

	// @behavior I-017
	it('should generate at 1K when no resolution is named', async () => {
		await createImage({ prompt: 'a red bicycle' });

		expect(generations[0].inputs).toMatchObject({ resolution: '1K' });
	});

	// @behavior I-018
	it('should refuse an encoding the model cannot store', async () => {
		const result = await createImage({ prompt: 'a red bicycle', model: 'google/nano-banana-2', format: 'webp' });

		expect(result.isError).toBe(true);
		expect(generations).toHaveLength(0);
	});

	// @behavior I-019
	it('should refuse a resolution the model cannot generate', async () => {
		const result = await createImage({ prompt: 'a red bicycle', model: 'google/nano-banana-2-lite', resolution: '4K' });

		expect(result.isError).toBe(true);
		expect(generations).toHaveLength(0);
	});

	// @behavior I-020
	it('should refuse a shape the model cannot draw', async () => {
		const result = await createImage({ prompt: 'a red bicycle', model: 'openai/gpt-image-2.5-flare', aspect_ratio: '16:9' });

		expect(result.isError).toBe(true);
		expect(generations).toHaveLength(0);
	});

	// @behavior I-021
	it('should refuse a quality the model cannot be asked for', async () => {
		const result = await createImage({ prompt: 'a red bicycle', model: 'google/nano-banana-2', quality: 'high' });

		expect(result.isError).toBe(true);
		expect(generations).toHaveLength(0);
	});

	// @behavior I-022
	it('should generate at low quality when a GPT Image model is named no quality', async () => {
		await createImage({ prompt: 'a red bicycle', model: 'openai/gpt-image-2.5-flare' });

		expect(generations[0].inputs).toMatchObject({ quality: 'low' });
	});

	// @behavior I-023
	it('should refuse a transparent background the model cannot leave', async () => {
		const result = await createImage({ prompt: 'a red bicycle', model: 'google/nano-banana-2', background: 'transparent' });

		expect(result.isError).toBe(true);
		expect(generations).toHaveLength(0);
	});

	// @behavior I-024
	it('should ask for no background when a model that paints only opaque ones is asked for one', async () => {
		const result = await createImage({ prompt: 'a red bicycle', model: 'google/nano-banana-2', background: 'opaque' });

		expect(result.isError).toBeFalsy();
		expect(generations[0].inputs).not.toHaveProperty('background');
	});

	// @behavior I-025
	it('should refuse a transparent background stored as jpg', async () => {
		const result = await createImage({
			prompt: 'a red bicycle',
			model: 'openai/gpt-image-2.5-flare',
			format: 'jpg',
			background: 'transparent',
		});

		expect(result.isError).toBe(true);
		expect(generations).toHaveLength(0);
	});
});
