import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
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

/** A request on its way to one model: the caller's words, not yet translated. */
type Drawn = {
	prompt: string;
	aspect_ratio?: AspectRatio;
	format?: Format;
	resolution: Resolution;
};

/**
 * The part of a request every model names alike, and the keys a caller left
 * unnamed are dropped rather than sent empty: a model was never asked for what
 * nobody said.
 */
const agreed = ({ prompt, aspect_ratio, format }: Drawn) => ({
	prompt,
	...(aspect_ratio && { aspect_ratio }),
	...(format && { output_format: format }),
});

/**
 * What one model can be asked for, and what it calls each thing. The models
 * agree on everything but the name of the resolution and on how much they can
 * do, so the tool keeps one vocabulary and every painter states how much of it
 * it answers to.
 */
type Painter = {
	/** Which of this tool's formats it can store. */
	formats: readonly Format[];
	/** Which of this tool's resolutions it can generate. */
	resolutions: readonly Resolution[];
	/** The request in the model's own vocabulary. */
	request: (drawn: Drawn) => Record<string, unknown>;
};

const PAINTERS: Record<Model, Painter> = {
	'google/nano-banana-pro': {
		formats: ['jpg', 'png', 'webp'],
		resolutions: ['1K', '2K', '4K'],
		request: (drawn) => ({ ...agreed(drawn), image_size: drawn.resolution }),
	},
	'google/nano-banana-2': {
		formats: ['jpg', 'png'],
		resolutions: ['1K', '2K', '4K'],
		request: (drawn) => ({ ...agreed(drawn), resolution: drawn.resolution }),
	},
	'google/nano-banana-2-lite': {
		formats: ['jpg', 'png'],
		resolutions: ['1K'],
		request: (drawn) => ({ ...agreed(drawn), resolution: drawn.resolution }),
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

export const registerCreateImage = (server: McpServer, ai: Ai, options?: AiOptions) =>
	server.registerTool(
		'create_image',
		{
			title: 'Create image',
			description: 'Generate an image from a prompt. The reply links to the generated image rather than carrying it.',
			inputSchema,
			outputSchema,
		},
		async ({ model, ...drawn }) => {
			const painter = PAINTERS[model];
			const answer = await ai.run(model, painter.request(drawn), options);
			const link = linkFrom(answer, 'image');
			const asked = drawn.format ? MIME_TYPES[drawn.format] : undefined;
			const mimeType = (await storedEncodingOf(link)) ?? asked;

			return {
				content: [
					{
						type: 'resource_link',
						uri: link,
						name: 'generated-image',
						title: drawn.prompt,
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
