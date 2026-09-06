import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import app from '../src/index';
import { aiAnswering, type Generation } from './workers-ai';

// The link the model answers with. Its form is the model's own; the tool hands
// it on without reading anything into it.
const IMAGE = 'https://example.r2.cloudflarestorage.com/generated.png?signature=stand-in';

const ENDPOINT = new URL('https://creator.example.com/mcp');

// Access is settled in its own feature; DEBUG carries every caller here through.
const envWith = (ai: Ai): Env => ({
	DEBUG: 'true',
	TEAM_NAME: 'creator',
	POLICY_AUD: 'test-policy-aud',
	AI: ai,
});

const connect = async (env: Env) => {
	const client = new Client({ name: 'test-harness', version: '0.0.0' });
	await client.connect(
		new StreamableHTTPClientTransport(ENDPOINT, {
			fetch: async (url, init) => app.fetch(new Request(url, init), env),
		}),
	);

	return client;
};

let client: Client;
let generations: Generation[];

beforeEach(async () => {
	const workersAi = aiAnswering({ image: IMAGE });
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
	it('should name the encoding when the caller asked for one', async () => {
		const { content } = await createImage({ prompt: 'a red bicycle', output_format: 'webp' });

		expect(content).toEqual([expect.objectContaining({ mimeType: 'image/webp' })]);
	});

	// @behavior I-007
	it('should leave the encoding unstated when the caller asked for none', async () => {
		const { content } = await createImage({ prompt: 'a red bicycle' });

		expect(content).toEqual([expect.not.objectContaining({ mimeType: expect.anything() })]);
	});

	// @behavior I-008
	it('should fail when the model answers without a link', async () => {
		const stranded = await connect(envWith(aiAnswering({ state: 'Completed' }).ai));

		const result = await stranded.callTool({ name: 'create_image', arguments: { prompt: 'a red bicycle' } });

		expect(result.isError).toBe(true);
		await stranded.close();
	});
});
