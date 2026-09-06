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
const AUDIO_PATH = 'https://ai-gateway-outputs.example.r2.cloudflarestorage.com/provider-outputs/stand-in/stand-in';
const AUDIO = `${AUDIO_PATH}?X-Amz-Expires=86400&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=stand-in`;

// Standing in for the store the link points at. It is asked for one byte, and
// what it answers with is the encoding the reply reports.
const network = setupNetwork();

// What the store was asked for, so a test can say that the audio was left
// where it is rather than pulled through the Worker.
let ranges: (string | null)[] = [];

const storeHolding = (contentType: string) =>
	http.get(AUDIO_PATH, ({ request }) => {
		ranges.push(request.headers.get('range'));

		return new HttpResponse(null, { status: 206, headers: { 'content-type': contentType } });
	});

const storeRefusing = () => http.get(AUDIO_PATH, () => new HttpResponse(null, { status: 403 }));

// The gateway wraps the model's output; `gatewayMetadata` rides along on some
// answers and not others, which is why nothing but the link is read.
const answering = (audio: string) => ({ state: 'Completed', result: { audio } });

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
	network.resetHandlers(storeHolding('audio/mpeg'));

	const workersAi = aiAnswering(answering(AUDIO));
	generations = workersAi.generations;
	client = await connect(workersAi.ai);
});

afterEach(() => client.close());

const createAudio = (args: Record<string, unknown>) => client.callTool({ name: 'create_audio', arguments: args });

type Content = Awaited<ReturnType<Client['callTool']>>['content'];

// A promise about the link or the text is a promise about that block, not about
// where in the reply it sits.
const linkIn = (content: Content) => content?.find(({ type }) => type === 'resource_link');
const textIn = (content: Content) => content?.find(({ type }) => type === 'text');

describe('audio generation', () => {
	// @behavior AU-001
	it('should offer the tool when a client lists them', async () => {
		const { tools } = await client.listTools();

		expect(tools.map(({ name }) => name)).toContain('create_audio');
	});

	// @behavior AU-002
	it('should speak the text when the tool is called', async () => {
		await createAudio({ text: 'the tide is turning' });

		expect(generations[0].inputs).toMatchObject({ text: 'the tide is turning' });
	});

	// @behavior AU-003
	it('should speak with tts-1 when no model is named', async () => {
		await createAudio({ text: 'the tide is turning' });

		expect(generations[0].model).toBe('openai/tts-1');
	});

	// An exact match rather than a subset: a key the model never asked for is
	// as wrong as a key under the wrong name.
	// @behavior AU-004
	it('should ask tts-1 in its own words when it is the model', async () => {
		await createAudio({ text: 'the tide is turning', model: 'openai/tts-1', voice: 'nova', format: 'flac', speed: 1.25 });

		expect(generations[0].inputs).toStrictEqual({
			text: 'the tide is turning',
			voice: 'nova',
			response_format: 'flac',
			speed: 1.25,
		});
	});

	// @behavior AU-004
	it('should ask eleven-v3 in its own words when it is the model', async () => {
		await createAudio({ text: 'the tide is turning', model: 'elevenlabs/eleven-v3', voice: 'JBFqnCBsd6RMkjVDRZzb', format: 'mp3' });

		expect(generations[0].inputs).toStrictEqual({
			text: 'the tide is turning',
			voice_id: 'JBFqnCBsd6RMkjVDRZzb',
			output_format: 'mp3_44100_128',
		});
	});

	// @behavior AU-005
	it('should carry the link as given when the model answers', async () => {
		const { content } = await createAudio({ text: 'the tide is turning' });

		expect(linkIn(content)).toMatchObject({ type: 'resource_link', uri: AUDIO });
	});

	// @behavior AU-006
	it('should state what the store holds when the caller asked for something else', async () => {
		const { content } = await createAudio({ text: 'the tide is turning', format: 'flac' });

		expect(linkIn(content)).toMatchObject({ mimeType: 'audio/mpeg' });
	});

	// @behavior AU-007
	it('should state the encoding the caller asked for when the store will not say', async () => {
		network.resetHandlers(storeRefusing());

		const { content } = await createAudio({ text: 'the tide is turning', format: 'wav' });

		expect(linkIn(content)).toMatchObject({ mimeType: 'audio/wav' });
	});

	// @behavior AU-007
	it('should state the encoding the caller asked for when the store cannot be reached', async () => {
		network.resetHandlers(http.get(AUDIO_PATH, () => HttpResponse.error()));

		const { content } = await createAudio({ text: 'the tide is turning', format: 'opus' });

		expect(linkIn(content)).toMatchObject({ mimeType: 'audio/ogg' });
	});

	// @behavior AU-008
	it('should fail when the model answers without a link', async () => {
		const stranded = await connect(aiAnswering({ state: 'Completed', result: {} }).ai);

		const result = await stranded.callTool({ name: 'create_audio', arguments: { text: 'the tide is turning' } });

		expect(result.isError).toBe(true);
		await stranded.close();
	});

	// @behavior AU-009
	it('should state no encoding when neither the store nor the caller gives one', async () => {
		network.resetHandlers(storeRefusing());

		const { content } = await createAudio({ text: 'the tide is turning' });

		expect(linkIn(content)).not.toHaveProperty('mimeType');
	});

	// @behavior AU-010
	it('should ask the store for a single byte when it asks what the audio is', async () => {
		await createAudio({ text: 'the tide is turning' });

		expect(ranges).toEqual(['bytes=0-0']);
	});

	// @behavior AU-011
	it('should reach the model through the gateway when a deployment names one', async () => {
		const workersAi = aiAnswering(answering(AUDIO));
		const routed = await connect(workersAi.ai, 'hibi');

		await routed.callTool({ name: 'create_audio', arguments: { text: 'the tide is turning' } });

		expect(workersAi.generations[0].options).toMatchObject({ gateway: { id: 'hibi' } });
		await routed.close();
	});

	// @behavior AU-012
	it('should carry the link and its encoding as structured content when the model answers', async () => {
		const { structuredContent } = await createAudio({ text: 'the tide is turning' });

		expect(structuredContent).toStrictEqual({ uri: AUDIO, mime_type: 'audio/mpeg' });
	});

	// @behavior AU-013
	it('should state the shape of its reply when a client lists the tools', async () => {
		const { tools } = await client.listTools();

		expect(tools.find(({ name }) => name === 'create_audio')?.outputSchema).toMatchObject({
			properties: { uri: { type: 'string' }, mime_type: { type: 'string' } },
			required: ['uri'],
		});
	});

	// @behavior AU-014
	it('should state the link in text when the model answers', async () => {
		const { content } = await createAudio({ text: 'the tide is turning' });

		expect(textIn(content)).toMatchObject({ text: expect.stringContaining(AUDIO) });
	});

	// @behavior AU-014
	it('should say how long the link stands when it states it in text', async () => {
		const { content } = await createAudio({ text: 'the tide is turning' });

		expect(textIn(content)).toMatchObject({ text: expect.stringMatching(/about a day/) });
	});
	// A refusal is a promise about what did NOT happen as much as about the
	// reply: the point of refusing is that nothing is billed and nothing is
	// generated, so every case says the model was never reached.
	// @behavior AU-015
	it('should refuse when the text is longer than the model speaks', async () => {
		const result = await createAudio({ text: 'a'.repeat(4097), model: 'openai/tts-1' });

		expect(result.isError).toBe(true);
		expect(generations).toHaveLength(0);
	});

	// @behavior AU-016
	it('should refuse when eleven-v3 is asked without a voice', async () => {
		const result = await createAudio({ text: 'the tide is turning', model: 'elevenlabs/eleven-v3' });

		expect(result.isError).toBe(true);
		expect(generations).toHaveLength(0);
	});

	// @behavior AU-017
	it('should refuse a voice the model does not have', async () => {
		const result = await createAudio({ text: 'the tide is turning', model: 'openai/tts-1', voice: 'JBFqnCBsd6RMkjVDRZzb' });

		expect(result.isError).toBe(true);
		expect(generations).toHaveLength(0);
	});

	// @behavior AU-018
	it('should refuse an encoding the model cannot store', async () => {
		const result = await createAudio({
			text: 'the tide is turning',
			model: 'elevenlabs/eleven-v3',
			voice: 'JBFqnCBsd6RMkjVDRZzb',
			format: 'wav',
		});

		expect(result.isError).toBe(true);
		expect(generations).toHaveLength(0);
	});

	// @behavior AU-019
	it('should refuse a speed the model cannot vary', async () => {
		const result = await createAudio({
			text: 'the tide is turning',
			model: 'elevenlabs/eleven-v3',
			voice: 'JBFqnCBsd6RMkjVDRZzb',
			speed: 1.5,
		});

		expect(result.isError).toBe(true);
		expect(generations).toHaveLength(0);
	});

	// Speed 1 is what this model does anyway, so the request is already met and
	// the key is simply not among what it is asked.
	// @behavior AU-020
	it('should speak without a speed when a model that cannot vary is asked for no change', async () => {
		await createAudio({ text: 'the tide is turning', model: 'elevenlabs/eleven-v3', voice: 'JBFqnCBsd6RMkjVDRZzb', speed: 1 });

		expect(generations[0].inputs).toStrictEqual({ text: 'the tide is turning', voice_id: 'JBFqnCBsd6RMkjVDRZzb' });
	});
	// The refusal exists so the caller can ask again, which it can only do if
	// the reason reaches it. `isError` alone would leave it guessing.
	// @behavior AU-021
	it('should say the way out when it refuses', async () => {
		const result = await createAudio({
			text: 'the tide is turning',
			model: 'elevenlabs/eleven-v3',
			voice: 'JBFqnCBsd6RMkjVDRZzb',
			speed: 1.5,
		});

		expect(textIn(result.content)).toMatchObject({ text: expect.stringContaining('Drop `speed`') });
	});

	// A per-model limit cannot be stated in a JSON Schema whose type must be
	// object, so the argument's own description is the only place a caller can
	// read it. Nothing else in this suite would notice it going missing.
	// @behavior AU-022
	it('should state what each model accepts on the arguments when a client lists the tools', async () => {
		const { tools } = await client.listTools();
		const properties = tools.find(({ name }) => name === 'create_audio')?.inputSchema.properties as
			Record<string, { description?: string }> | undefined;

		expect(properties?.voice.description).toContain('elevenlabs/eleven-v3 takes an ElevenLabs voice ID, and requires one');
		expect(properties?.format.description).toContain('elevenlabs/eleven-v3 stores only mp3 or opus');
		expect(properties?.speed.description).toContain('Only openai/tts-1 can vary it');
	});
});
