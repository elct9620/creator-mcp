import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { linkFrom, storedEncodingOf } from './stored';

/**
 * The models this tool generates with. Each one answers with a link to what it
 * stored rather than with the image itself; a model that returns image bytes
 * would need a different reply and does not belong on this list.
 */
const MODELS = ['google/nano-banana-pro'] as const;
const DEFAULT_MODEL = 'google/nano-banana-pro';

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

const MIME_TYPES: Record<(typeof FORMATS)[number], string> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
};

const inputSchema = z.object({
	prompt: z.string().describe('What the image should show.'),
	model: z.enum(MODELS).default(DEFAULT_MODEL).describe('The model to generate with.'),
	aspect_ratio: z.enum(ASPECT_RATIOS).optional().describe('The shape of the image.'),
	format: z.enum(FORMATS).optional().describe('The encoding the image is stored in.'),
	resolution: z.enum(RESOLUTIONS).default(DEFAULT_RESOLUTION).describe('How large the generated image is.'),
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
		async ({ prompt, model, aspect_ratio, format, resolution }) => {
			// `google/nano-banana-pro` calls the encoding `output_format` and the
			// resolution `image_size`. Those are the model's words, and they stop
			// here: what the caller says is settled in `.spec/glossary.md`.
			const answer = await ai.run(
				model,
				{ prompt, image_size: resolution, ...(aspect_ratio && { aspect_ratio }), ...(format && { output_format: format }) },
				options,
			);
			const link = linkFrom(answer, 'image');
			const asked = format ? MIME_TYPES[format] : undefined;
			const mimeType = (await storedEncodingOf(link)) ?? asked;

			return {
				content: [
					{
						type: 'resource_link',
						uri: link,
						name: 'generated-image',
						title: prompt,
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
