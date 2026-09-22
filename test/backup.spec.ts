import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { setupNetwork } from '@msw/cloudflare';
import { env, exports } from 'cloudflare:workers';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { asMatched, asNameless } from './access';
import { aiAnswering } from './workers-ai';

const IMAGE_PATH = 'https://ai-gateway-outputs.example.r2.cloudflarestorage.com/provider-outputs/stand-in/stand-in';
const IMAGE = `${IMAGE_PATH}?X-Amz-Expires=86400&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=stand-in`;

// The first sixteen hex digits of the SHA-256 of the address `asMatched`
// carries, which is the folder every copy in this file lands in.
const USER = '72497f475e4f76d0';

// A moment whose date is not the same in UTC as in Asia/Taipei, which is what
// makes the zone observable rather than incidental.
const GENERATED_AT = new Date('2026-09-23T16:30:45Z');

const BYTES = 'stand-in bytes';

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
const connect = async (deployment: Record<string, unknown>, matched = asMatched) => {
	Object.assign(env, { AI: aiAnswering(answering(IMAGE)).ai, BUCKET, BACKUP: undefined, TZ: undefined }, deployment);

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

const createImage = () => client.callTool({ name: 'create_image', arguments: { prompt: 'a red bicycle' } });

describe('Backup', () => {
	// @behavior B-001
	it('should keep nothing when the deployment asked for no backups', async () => {
		client = await connect({});

		await createImage();

		expect(await kept()).toStrictEqual([]);
	});

	// @behavior B-002
	it('should keep a copy under the caller and the day when the deployment asked for backups', async () => {
		client = await connect({ BACKUP: 'yes' });

		await createImage();

		expect(await kept()).toStrictEqual([expect.stringMatching(new RegExp(`^backup/${USER}/2026-09-23/163045-[0-9a-f]{4}\\.png$`))]);
	});

	// @behavior B-003
	it('should answer with the model own link when a copy was kept', async () => {
		client = await connect({ BACKUP: 'yes' });

		const { structuredContent } = await createImage();

		expect(structuredContent).toStrictEqual({ uri: IMAGE, mime_type: 'image/png' });
	});

	// @behavior B-004
	it('should read the day in the zone the deployment names', async () => {
		client = await connect({ BACKUP: 'yes', TZ: 'Asia/Taipei' });

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
		client = await connect({ BACKUP: 'yes', TZ });

		await createImage();

		expect(await kept()).toStrictEqual([expect.stringContaining(`${USER}/2026-09-23/163045-`)]);
	});

	// @behavior B-007
	it('should keep nothing when Access resolved no address for the caller', async () => {
		client = await connect({ BACKUP: 'yes' }, asNameless);

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
		client = await connect({ BACKUP: 'yes' });

		await createImage();

		expect(await kept()).toStrictEqual([]);
		expect(warned).toHaveBeenCalledWith(expect.stringContaining('how long the file is'));

		warned.mockRestore();
	});

	// @behavior B-009
	it('should answer the caller as it would have when the bucket refuses the write', async () => {
		const refusing = { put: () => Promise.reject(new Error('the bucket refused')) } as unknown as R2Bucket;
		client = await connect({ BACKUP: 'yes', BUCKET: refusing });

		const { structuredContent } = await createImage();

		expect(structuredContent).toStrictEqual({ uri: IMAGE, mime_type: 'image/png' });
	});
});
