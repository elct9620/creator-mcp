import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { Backup } from './backup';
import { named } from './named';
import { linkFrom, storedEncodingOf } from './stored';

/**
 * The models this tool generates with. Each one answers with a link to what it
 * stored rather than with the image itself; a model that returns image bytes
 * would need a different reply and does not belong on this list.
 */
const MODELS = [
	'google/nano-banana-pro',
	'google/nano-banana-2',
	'google/nano-banana-2-lite',
	'openai/gpt-image-2.5-flare',
	'openai/gpt-image-2.5-sunburst',
] as const;

/**
 * The same reason that picks the smallest resolution picks the model: a caller
 * who said nothing has not asked to pay more, and Google's tiers put this one
 * below `google/nano-banana-pro`. It is not Google's cheapest tier —
 * `google/nano-banana-2-lite` is — but that one generates 1K alone, and a
 * default that quietly caps what can be asked for is a different thing from a
 * default that costs less.
 */
const DEFAULT_MODEL = 'google/nano-banana-2';

const ASPECT_RATIOS = ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const;
const FORMATS = ['jpg', 'png', 'webp'] as const;
const RESOLUTIONS = ['1K', '2K', '4K'] as const;
const QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max', 'auto'] as const;
const BACKGROUNDS = ['transparent', 'opaque'] as const;

/**
 * The smallest is the default because it is the cheapest, and a caller who
 * said nothing has not asked to pay more. Which one the model would reach for
 * on its own is undocumented, so naming one is also what makes the same call
 * answer the same way twice.
 */
const DEFAULT_RESOLUTION = '1K';

/**
 * The same reason as the resolution's: what an image costs follows the tokens
 * it takes, and a higher quality takes more. Left to `auto`, the model decides
 * from the prompt, so naming one is also what makes the same call answer the
 * same way twice. It applies only to a model that can be asked for a quality.
 */
const DEFAULT_QUALITY = 'low';

type Model = (typeof MODELS)[number];
type AspectRatio = (typeof ASPECT_RATIOS)[number];
type Format = (typeof FORMATS)[number];
type Resolution = (typeof RESOLUTIONS)[number];
type Quality = (typeof QUALITIES)[number];
type Background = (typeof BACKGROUNDS)[number];

const MIME_TYPES: Record<Format, string> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
};

/** The same map read the other way: what a file holding this encoding is called. */
const EXTENSIONS: Record<string, string> = Object.fromEntries(Object.entries(MIME_TYPES).map(([format, mime]) => [mime, format]));

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
	quality?: Quality;
	background?: Background;
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
	/** Whether it can be asked how much to put into an image. */
	quality: boolean;
	/** Whether it can leave the background transparent. One that cannot paints it opaque. */
	transparent: boolean;
	/** The request in the model's own vocabulary. */
	request: (drawn: Drawn) => Record<string, unknown>;
};

/** Every one of these words, called by the model what this tool calls it. */
const alike = <Word extends string>(words: readonly Word[]) => Object.fromEntries(words.map((word) => [word, word])) as Record<Word, Word>;

/**
 * Both GPT Image models are asked for a size in pixels, and Cloudflare's schema
 * admits three. Each is reached by the shape it has at `1K`, so a caller names
 * the image the way they would for any other model.
 */
const GPT_IMAGE: Painter = {
	formats: { jpg: 'jpeg', png: 'png', webp: 'webp' },
	shapes: { '1:1': '1024x1024', '2:3': '1024x1536', '3:2': '1536x1024' },
	resolutions: ['1K'],
	quality: true,
	transparent: true,
	request: ({ prompt, aspect_ratio, format, quality, background }) => ({
		prompt,
		size: aspect_ratio,
		output_format: format,
		quality,
		background,
	}),
};

const PAINTERS: Record<Model, Painter> = {
	'google/nano-banana-pro': {
		formats: alike(['jpg', 'png', 'webp']),
		shapes: alike(ASPECT_RATIOS),
		resolutions: ['1K', '2K', '4K'],
		quality: false,
		transparent: false,
		request: ({ prompt, aspect_ratio, format, resolution }) => ({ prompt, aspect_ratio, output_format: format, image_size: resolution }),
	},
	'google/nano-banana-2': {
		formats: alike(['jpg', 'png']),
		shapes: alike(ASPECT_RATIOS),
		resolutions: ['1K', '2K', '4K'],
		quality: false,
		transparent: false,
		request: ({ prompt, aspect_ratio, format, resolution }) => ({ prompt, aspect_ratio, output_format: format, resolution }),
	},
	'google/nano-banana-2-lite': {
		formats: alike(['jpg', 'png']),
		shapes: alike(ASPECT_RATIOS),
		resolutions: ['1K'],
		quality: false,
		transparent: false,
		request: ({ prompt, aspect_ratio, format, resolution }) => ({ prompt, aspect_ratio, output_format: format, resolution }),
	},
	'openai/gpt-image-2.5-flare': GPT_IMAGE,
	'openai/gpt-image-2.5-sunburst': GPT_IMAGE,
};

const inputSchema = z.object({
	prompt: z.string().describe('What the image should show.'),
	model: z
		.enum(MODELS)
		.default(DEFAULT_MODEL)
		.describe(
			'The model to generate with. Of the nano banana models, google/nano-banana-pro costs the most and ' +
				'google/nano-banana-2-lite the least. Of the GPT Image models, openai/gpt-image-2.5-flare is the faster ' +
				'and openai/gpt-image-2.5-sunburst the more capable.',
		),
	aspect_ratio: z.enum(ASPECT_RATIOS).optional().describe('The shape of the image. The GPT Image models draw 1:1, 2:3 or 3:2 alone.'),
	format: z
		.enum(FORMATS)
		.optional()
		.describe('The encoding the image is stored in. google/nano-banana-2 and google/nano-banana-2-lite do not store webp.'),
	resolution: z
		.enum(RESOLUTIONS)
		.default(DEFAULT_RESOLUTION)
		.describe('How large the generated image is. google/nano-banana-2-lite and the GPT Image models generate 1K alone.'),
	quality: z
		.enum(QUALITIES)
		.optional()
		.describe('How much goes into the image. Only the GPT Image models can be asked, and they generate at low when none is named.'),
	background: z
		.enum(BACKGROUNDS)
		.optional()
		.describe(
			'Whether the background is left transparent or painted opaque. Only the GPT Image models can leave it transparent, and not in jpg.',
		),
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
 * an encoding that fell back to the model's own, a shape or a resolution it
 * never had, a quality it ignored. Each refusal names the way out, so a caller
 * can ask again rather than only be told no.
 *
 * It is thrown from the call rather than declared in the schema, because the
 * constraint is per model and a tool's `inputSchema` is one JSON Schema object
 * with nowhere to put it. Thrown, it comes back as a tool error carrying the
 * sentence, which is the form that reaches the model that called.
 */
const refuseWhatItCannotDo = (model: Model, { aspect_ratio, format, resolution, quality, background }: Asked) => {
	const painter = PAINTERS[model];

	if (format !== undefined && painter.formats[format] === undefined)
		throw new Error(`${model} cannot store ${format}. It stores ${Object.keys(painter.formats).join(', ')}.`);

	if (aspect_ratio !== undefined && painter.shapes[aspect_ratio] === undefined)
		throw new Error(`${model} cannot draw ${aspect_ratio}. It draws ${Object.keys(painter.shapes).join(', ')}.`);

	if (!painter.resolutions.includes(resolution))
		throw new Error(`${model} cannot generate ${resolution}. It generates ${painter.resolutions.join(', ')}.`);

	if (quality !== undefined && !painter.quality)
		throw new Error(`${model} cannot be asked for a quality. Drop \`quality\`, or generate with a GPT Image model.`);

	// Asking a model that always paints the background opaque for that same
	// background is a request it already meets, so it is let through and dropped
	// in translation rather than refused.
	if (background === 'transparent' && !painter.transparent)
		throw new Error(`${model} cannot leave the background transparent. Drop \`background\`, or generate with a GPT Image model.`);

	if (background === 'transparent' && format === 'jpg')
		throw new Error('jpg cannot hold a transparent background. Store it as png or webp.');
};

export const registerCreateImage = (server: McpServer, ai: Ai, backup: Backup | undefined, options?: AiOptions) =>
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
				quality: painter.quality ? (asked.quality ?? DEFAULT_QUALITY) : undefined,
			};
			const answer = await ai.run(model, named(painter.request(drawn)), options);
			const link = linkFrom(answer, 'image');
			const fallback = asked.format ? MIME_TYPES[asked.format] : undefined;
			const mimeType = (await storedEncodingOf(link)) ?? fallback;
			await backup?.(link, mimeType ? EXTENSIONS[mimeType] : undefined);

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
