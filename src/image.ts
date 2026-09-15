import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { named } from './named';
import { linkFrom, storedEncodingOf } from './stored';

/**
 * The models this tool generates with. Each one answers with a link to what it
 * stored rather than with the image itself; a model that returns image bytes
 * would need a different reply and does not belong on this list.
 */
const MODELS = ['google/nano-banana-pro', 'google/nano-banana-2', 'google/nano-banana-2-lite'] as const;

/**
 * The same reason that picks the smallest resolution picks the model: a caller
 * who said nothing has not asked to pay more, and the provider's tiers put this
 * one below `google/nano-banana-pro`. It is not the cheapest tier —
 * `google/nano-banana-2-lite` is — but that one generates 1K alone, and a
 * default that quietly caps what can be asked for is a different thing from a
 * default that costs less.
 */
const DEFAULT_MODEL = 'google/nano-banana-2';

const ASPECT_RATIOS = ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const;
const FORMATS = ['jpg', 'png', 'webp'] as const;
const RESOLUTIONS = ['1K', '2K', '4K'] as const;

/**
 * The smallest is the default because it is the cheapest, and a caller who
 * said nothing has not asked to pay more. Which one the model would reach for
 * on its own is undocumented, so naming one is also what makes the same call
 * answer the same way twice.
 */
const DEFAULT_RESOLUTION = '1K';

type Model = (typeof MODELS)[number];
type AspectRatio = (typeof ASPECT_RATIOS)[number];
type Format = (typeof FORMATS)[number];
type Resolution = (typeof RESOLUTIONS)[number];

const MIME_TYPES: Record<Format, string> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
};

/**
 * A request on its way to one model: the caller's words, part-way translated.
 * The shape and the format are already in the model's own names for them,
 * because only the painter knows those names.
 */
type Drawn = {
	prompt: string;
	aspect_ratio?: string;
	format?: string;
	resolution: Resolution;
};

/**
 * What one model can be asked for, and what it calls each thing. Models name
 * the same idea differently and cannot always do it at all, so the tool keeps
 * one vocabulary and every painter states how much of it it answers to.
 */
type Painter = {
	/** Which of this tool's formats it can store, and what it calls each. */
	formats: Partial<Record<Format, string>>;
	/** Which of this tool's aspect ratios it can draw, and what it calls each. */
	shapes: Partial<Record<AspectRatio, string>>;
	/** Which of this tool's resolutions it can generate. */
	resolutions: readonly Resolution[];
	/** The request in the model's own vocabulary. */
	request: (drawn: Drawn) => Record<string, unknown>;
};

/** Every one of these words, called by the model what this tool calls it. */
const alike = <Word extends string>(words: readonly Word[]) => Object.fromEntries(words.map((word) => [word, word])) as Record<Word, Word>;

const PAINTERS: Record<Model, Painter> = {
	'google/nano-banana-pro': {
		formats: alike(['jpg', 'png', 'webp']),
		shapes: alike(ASPECT_RATIOS),
		resolutions: ['1K', '2K', '4K'],
		request: ({ prompt, aspect_ratio, format, resolution }) => ({ prompt, aspect_ratio, output_format: format, image_size: resolution }),
	},
	'google/nano-banana-2': {
		formats: alike(['jpg', 'png']),
		shapes: alike(ASPECT_RATIOS),
		resolutions: ['1K', '2K', '4K'],
		request: ({ prompt, aspect_ratio, format, resolution }) => ({ prompt, aspect_ratio, output_format: format, resolution }),
	},
	'google/nano-banana-2-lite': {
		formats: alike(['jpg', 'png']),
		shapes: alike(ASPECT_RATIOS),
		resolutions: ['1K'],
		request: ({ prompt, aspect_ratio, format, resolution }) => ({ prompt, aspect_ratio, output_format: format, resolution }),
	},
};

const inputSchema = z.object({
	prompt: z.string().describe('What the image should show.'),
	model: z
		.enum(MODELS)
		.default(DEFAULT_MODEL)
		.describe(
			'The model to generate with. google/nano-banana-pro costs the most and is the only one that stores webp; ' +
				'google/nano-banana-2-lite is the cheapest and generates 1K alone.',
		),
	aspect_ratio: z.enum(ASPECT_RATIOS).optional().describe('The shape of the image.'),
	format: z.enum(FORMATS).optional().describe('The encoding the image is stored in. Only google/nano-banana-pro stores webp.'),
	resolution: z
		.enum(RESOLUTIONS)
		.default(DEFAULT_RESOLUTION)
		.describe('How large the generated image is. google/nano-banana-2-lite generates 1K alone.'),
});

const outputSchema = z.object({
	uri: z.string().describe('Where the generated image is stored.'),
	mime_type: z.string().optional().describe('What the stored image is encoded as, when it can be known.'),
});

/** What a caller said, in this tool's words. */
type Asked = Omit<z.infer<typeof inputSchema>, 'model'>;

/**
 * A request the chosen model cannot honour is refused before it is sent,
 * because the alternative is an image that quietly is not what was asked for:
 * an encoding that fell back to the model's own, a resolution it never had.
 * Each refusal names the way out, so a caller can ask again rather than only
 * be told no.
 *
 * It is thrown from the call rather than declared in the schema, because the
 * constraint is per model and a tool's `inputSchema` is one JSON Schema object
 * with nowhere to put it. Thrown, it comes back as a tool error carrying the
 * sentence, which is the form that reaches the model that called.
 */
const refuseWhatItCannotDo = (model: Model, { format, resolution }: Asked) => {
	const painter = PAINTERS[model];

	if (format !== undefined && painter.formats[format] === undefined)
		throw new Error(`${model} cannot store ${format}. It stores ${Object.keys(painter.formats).join(', ')}.`);

	if (!painter.resolutions.includes(resolution))
		throw new Error(`${model} cannot generate ${resolution}. It generates ${painter.resolutions.join(', ')}.`);
};

export const registerCreateImage = (server: McpServer, ai: Ai, options?: AiOptions) =>
	server.registerTool(
		'create_image',
		{
			title: 'Create image',
			description: 'Generate an image from a prompt. The reply links to the generated image rather than carrying it.',
			inputSchema,
			outputSchema,
		},
		async ({ model, ...asked }) => {
			refuseWhatItCannotDo(model, asked);

			const painter = PAINTERS[model];
			const drawn = {
				...asked,
				aspect_ratio: asked.aspect_ratio && painter.shapes[asked.aspect_ratio],
				format: asked.format && painter.formats[asked.format],
			};
			const answer = await ai.run(model, named(painter.request(drawn)), options);
			const link = linkFrom(answer, 'image');
			const fallback = asked.format ? MIME_TYPES[asked.format] : undefined;
			const mimeType = (await storedEncodingOf(link)) ?? fallback;

			return {
				content: [
					{
						type: 'resource_link',
						uri: link,
						name: 'generated-image',
						title: asked.prompt,
						mimeType,
					},
					{
						type: 'text',
						text: `The image is at ${link}. That link works for about a day, so save the image before then.`,
					},
				],
				structuredContent: { uri: link, mime_type: mimeType },
			};
		},
	);
