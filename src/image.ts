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
const OUTPUT_FORMATS = ['jpg', 'png', 'webp'] as const;
const IMAGE_SIZES = ['1K', '2K', '4K'] as const;

const MIME_TYPES: Record<(typeof OUTPUT_FORMATS)[number], string> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
};

const inputSchema = z.object({
	prompt: z.string().describe('What the image should show.'),
	model: z.enum(MODELS).default(DEFAULT_MODEL).describe('The model to generate with.'),
	aspect_ratio: z.enum(ASPECT_RATIOS).optional().describe('The shape of the image.'),
	output_format: z.enum(OUTPUT_FORMATS).optional().describe('The encoding the image is stored in.'),
	image_size: z.enum(IMAGE_SIZES).optional().describe('How much detail the image is generated at.'),
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
		async ({ prompt, model, ...generation }) => {
			const answer = await ai.run(model, { prompt, ...generation }, options);
			const link = linkFrom(answer, 'image');
			const asked = generation.output_format ? MIME_TYPES[generation.output_format] : undefined;
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
