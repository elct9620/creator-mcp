import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { setupNetwork } from '@msw/cloudflare';
import { env, exports } from 'cloudflare:workers';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { asMatched, asNameless } from './access';
import { aiAnswering, type Generation } from './workers-ai';

const IMAGE_PATH = 'https://ai-gateway-outputs.example.r2.cloudflarestorage.com/provider-outputs/stand-in/stand-in';
const IMAGE = `${IMAGE_PATH}?X-Amz-Expires=86400&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=stand-in`;

// The first sixteen hex digits of the SHA-256 of the address `asMatched`
// carries, which is the folder every copy in this file lands in.
const USER = '72497f475e4f76d0';

// A moment whose date is not the same in UTC as in Asia/Taipei, which is what
// makes the zone observable rather than incidental.
const GENERATED_AT = new Date('2026-09-23T16:30:45Z');

const BYTES = 'stand-in bytes';

// What a deployment states so that a link to its copy can be signed.
const SIGNING = {
	R2_ACCOUNT_ID: 'stand-in-account',
	R2_ACCESS_KEY_ID: 'stand-in-key',
	R2_SECRET_ACCESS_KEY: 'stand-in-secret',
	R2_BUCKET_NAME: 'stand-in-bucket',
};

/** A deployment that asked for copies and can link to them. */
const KEEPING = { BACKUP: 'yes', ...SIGNING };

const network = setupNetwork();

const storeHolding = () =>
	http.get(
		IMAGE_PATH,
		() =>
			new HttpResponse(BYTES, {
				headers: { 'content-type': 'image/png', 'content-length': String(BYTES.length) },
			}),
	);

// A store that answers without saying how long the file is. Reading it in
// whole to find out is what this Worker declines to do.
const storeOfUnknownLength = () =>
	http.get(IMAGE_PATH, () => {
		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(BYTES));
				controller.close();
			},
		});

		return new HttpResponse(body, { headers: { 'content-type': 'image/png' } });
	});

const ENDPOINT = new URL('https://creator.example.com/mcp');

// The bucket the pool simulates, held before any test swaps a refusing one in.
const BUCKET = env.BUCKET;

const answering = (image: string) => ({ state: 'Completed', result: { image } });

/**
 * A client whose deployment is the one named here: every binding this feature
 * reads is stated on each connection, so what the last test set never decides
 * what the next one observes.
 */
const connect = async (deployment: Record<string, unknown>, matched = asMatched, answer: Record<string, unknown> = answering(IMAGE)) => {
	const workersAi = aiAnswering(answer);
	generations = workersAi.generations;
	Object.assign(
		env,
		{
			AI: workersAi.ai,
			BUCKET,
			BACKUP: undefined,
			TZ: undefined,
			...Object.fromEntries(Object.keys(SIGNING).map((key) => [key, undefined])),
		},
		deployment,
	);

	const client = new Client({ name: 'test-harness', version: '0.0.0' });
	await client.connect(
		new StreamableHTTPClientTransport(ENDPOINT, {
			fetch: async (url, init) => exports.default.fetch(matched(new Request(url, init))),
		}),
	);

	return client;
};

const kept = async () => (await BUCKET.list()).objects.map(({ key }) => key);

let client: Client;
let generations: Generation[];

beforeAll(() => network.enable());
afterAll(() => network.disable());

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(GENERATED_AT);
	network.resetHandlers(storeHolding());

	for (const key of await kept()) await BUCKET.delete(key);
});

afterEach(async () => {
	vi.useRealTimers();
	await client.close();
});

const createImage = (called?: string) =>
	client.callTool({ name: 'create_image', arguments: { prompt: 'a red bicycle', ...(called === undefined ? {} : { name: called }) } });

describe('Backup', () => {
	// @behavior B-001
	it('should keep nothing when the deployment asked for no backups', async () => {
		client = await connect({});

		await createImage();

		expect(await kept()).toStrictEqual([]);
	});

	// @behavior B-002
	it('should keep a copy under the caller and the day when the deployment asked for backups', async () => {
		client = await connect({ ...KEEPING });

		await createImage();

		expect(await kept()).toStrictEqual([expect.stringMatching(new RegExp(`^backup/${USER}/2026-09-23/163045-[0-9a-f]{4}\\.png$`))]);
	});

	// @behavior B-003
	it('should link to the copy rather than to the model own store', async () => {
		client = await connect({ ...KEEPING });

		const { content, structuredContent } = await createImage();

		const [key] = await kept();
		const link = new URL((structuredContent as { uri: string }).uri);
		expect(link.origin).toBe('https://stand-in-account.r2.cloudflarestorage.com');
		expect(decodeURIComponent(link.pathname)).toBe(`/stand-in-bucket/${key}`);
		expect(content).toContainEqual(expect.objectContaining({ type: 'resource_link', uri: link.href }));
		expect(content).toContainEqual({ type: 'text', text: expect.stringContaining(link.href) });
	});

	// A name is the caller's own words, and a `?` or `#` in it would otherwise
	// end the path the link is signed for.
	// @behavior B-003
	it('should link to the copy whatever its name holds', async () => {
		client = await connect({ ...KEEPING });

		const { structuredContent } = await createImage('what? #1');

		const [key] = await kept();
		const link = new URL((structuredContent as { uri: string }).uri);
		expect(decodeURIComponent(link.pathname)).toBe(`/stand-in-bucket/${key}`);
		expect(link.hash).toBe('');
	});

	// @behavior B-014
	it('should sign the link to the copy for a day', async () => {
		client = await connect({ ...KEEPING });

		const { structuredContent } = await createImage();

		const { searchParams } = new URL((structuredContent as { uri: string }).uri);
		expect(searchParams.get('X-Amz-Expires')).toBe('86400');
		expect(searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
	});

	// A copy nobody can be linked to would hand the caller a link that fails
	// only once they follow it, so any one secret missing turns the copying off.
	// @behavior B-015
	it.each(Object.keys(SIGNING))(
		'should keep nothing, hand on the model own link, and name %s in the log when it is unset',
		async (missing) => {
			const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
			client = await connect({ ...KEEPING, [missing]: undefined });

			const { structuredContent } = await createImage();

			expect(await kept()).toStrictEqual([]);
			expect(structuredContent).toStrictEqual({ uri: IMAGE, mime_type: 'image/png' });
			expect(warned).toHaveBeenCalledWith(expect.stringContaining(missing));

			warned.mockRestore();
		},
	);

	// @behavior B-004
	it('should read the day in the zone the deployment names', async () => {
		client = await connect({ ...KEEPING, TZ: 'Asia/Taipei' });

		await createImage();

		expect(await kept()).toStrictEqual([expect.stringContaining(`${USER}/2026-09-24/003045-`)]);
	});

	// A zone nobody named and a zone that is not one are the same deployment:
	// one that said nothing this Worker can read a day in.
	// @behavior B-005
	// @behavior B-006
	it.each([
		['no zone is named', undefined],
		['the zone named is not one', 'Middle/Earth'],
	])('should read the day in UTC when %s', async (_, TZ) => {
		client = await connect({ ...KEEPING, TZ });

		await createImage();

		expect(await kept()).toStrictEqual([expect.stringContaining(`${USER}/2026-09-23/163045-`)]);
	});

	// @behavior B-007
	it('should keep nothing when Access resolved no address for the caller', async () => {
		client = await connect({ ...KEEPING }, asNameless);

		await createImage();

		expect(await kept()).toStrictEqual([]);
	});

	// Nothing kept is also what a write that threw would leave behind, so the
	// reason is what says this was declined rather than attempted: without it
	// the store's silence would reach the log as a type error and name nothing
	// a deployment could act on.
	// @behavior B-008
	it('should keep nothing and say why when the store will not say how long the file is', async () => {
		const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
		network.resetHandlers(storeOfUnknownLength());
		client = await connect({ ...KEEPING });

		await createImage();

		expect(await kept()).toStrictEqual([]);
		expect(warned).toHaveBeenCalledWith(expect.stringContaining('how long the file is'));

		warned.mockRestore();
	});

	// @behavior B-009
	it('should answer the caller as it would have when the bucket refuses the write', async () => {
		const refusing = { put: () => Promise.reject(new Error('the bucket refused')) } as unknown as R2Bucket;
		client = await connect({ ...KEEPING, BUCKET: refusing });

		const { structuredContent } = await createImage();

		expect(structuredContent).toStrictEqual({ uri: IMAGE, mime_type: 'image/png' });
	});

	// @behavior B-010
	it('should call the copy what the caller called it', async () => {
		client = await connect({ ...KEEPING });

		await createImage('a red bicycle');

		expect(await kept()).toStrictEqual([expect.stringMatching(/163045-[0-9a-f]{4}-a red bicycle\.png$/)]);
	});

	// A generation is paid for the moment it is made, so a name that cannot be
	// part of a path has to stop the call before the model is reached.
	// @behavior B-011
	it.each([
		['a slash', 'sunsets/red'],
		['a control character', 'sunset\u0007'],
	])('should refuse a name holding %s without asking the model', async (_, called) => {
		client = await connect({ ...KEEPING });

		const result = await createImage(called);

		expect(result.isError).toBe(true);
		expect(generations).toStrictEqual([]);
		expect(await kept()).toStrictEqual([]);
	});

	// @behavior B-012
	it.each(['create_image', 'create_audio'])('should state what a name may hold in the schema %s offers', async (tool) => {
		client = await connect({});

		const { tools } = await client.listTools();

		const { inputSchema } = tools.find(({ name }) => name === tool) ?? {};
		expect((inputSchema?.properties as Record<string, unknown>)?.name).toMatchObject({
			type: 'string',
			pattern: expect.any(String),
			maxLength: expect.any(Number),
		});
	});

	// A file handed over in the answer has no store behind it to read from; the
	// bytes the answer carried are what the copy holds.
	// @behavior B-013
	it('should keep a copy of a file the model handed over in the answer', async () => {
		client = await connect({ ...KEEPING }, asMatched, { audio: `data:audio/wav;base64,${btoa(BYTES)}` });

		await client.callTool({ name: 'create_audio', arguments: { text: 'the tide is turning' } });

		const [key] = await kept();
		expect(key).toMatch(new RegExp(`^backup/${USER}/2026-09-23/163045-[0-9a-f]{4}\\.wav$`));
		expect(await (await BUCKET.get(key))?.text()).toBe(BYTES);
	});
});
