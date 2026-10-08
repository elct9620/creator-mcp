import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { env, exports } from 'cloudflare:workers';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { asMatched } from './access';
import { unreachableAi } from './workers-ai';

const ENDPOINT = new URL('https://creator.example.com/mcp');

const client = new Client({ name: 'test-harness', version: '0.0.0' });

beforeAll(async () => {
	// Reading a guide never reaches a model.
	Object.assign(env, { AI: unreachableAi() });

	await client.connect(
		new StreamableHTTPClientTransport(ENDPOINT, {
			fetch: async (url, init) => exports.default.fetch(asMatched(new Request(url, init))),
		}),
	);
});

afterAll(() => client.close());

const readGuide = (name: string) => client.callTool({ name: 'read_guide', arguments: { name } });

const guideTool = async () => (await client.listTools()).tools.find(({ name }) => name === 'read_guide');

describe('Guides', () => {
	// @behavior G-001
	it('should offer the tool when a client lists them', async () => {
		expect(await guideTool()).toBeDefined();
	});

	// What a caller sees before reading anything: each guide by name, and the
	// one line its front matter says it is for.
	// @behavior G-002
	it('should name each guide and say what it is for', async () => {
		const tool = await guideTool();
		const name = (tool?.inputSchema.properties as Record<string, { enum?: string[] }> | undefined)?.name;

		expect(name?.enum).toStrictEqual(['gemini-tts']);
		expect(tool?.description).toContain('gemini-tts: How to steer the way google/gemini-3.8-flash-tts');
	});

	// @behavior G-003
	it('should hand back the guide without its front matter', async () => {
		const { content } = await readGuide('gemini-tts');

		// The heading is the guide's first line once the front matter is gone, so
		// a reply opening on it carries none of that front matter.
		expect(content?.find(({ type }) => type === 'text')).toMatchObject({
			text: expect.stringMatching(/^# Speaking with the Gemini models\n/),
		});
	});

	// @behavior G-004
	it('should fail when the name is no guide', async () => {
		const result = await readGuide('no-such-guide');

		expect(result.isError).toBe(true);
	});
});
