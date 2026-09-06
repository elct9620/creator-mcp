import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * The answer is the gateway's envelope around the model's own output, and none
 * of these models is in `AiModels`, so the binding types it as an open record
 * and nothing upstream would catch a shape that changed. This is the one place
 * stating what the answer has to carry. The envelope carries a `state`, and
 * `gatewayMetadata` on some answers but not others; the link is the whole of
 * what is read.
 */
const linkFrom = (answer: Record<string, unknown>): string => {
	const image = isRecord(answer.result) ? answer.result.image : undefined;
	if (typeof image !== 'string') throw new Error('The model answered without a link to an image.');

	return image;
};

// Long enough for a store that is answering, short enough that one which is
// not leaves the reply to the format the caller asked for instead of waiting.
const ENCODING_TIMEOUT_MS = 5000;

/**
 * What the stored image is really encoded as. A caller's output format is a
 * hint the model may not honour, so the store is asked rather than trusted to
 * have obeyed. One byte answers it: the range keeps the image out of the
 * Worker while the response states its type, and the link is signed for `GET`
 * alone, so a `HEAD` would be refused.
 */
const storedEncodingOf = async (link: string): Promise<string | undefined> => {
	try {
		const response = await fetch(link, {
			headers: { range: 'bytes=0-0' },
			signal: AbortSignal.timeout(ENCODING_TIMEOUT_MS),
		});
		await response.body?.cancel();
		if (!response.ok) return undefined;

		return response.headers.get('content-type')?.split(';')[0].trim() || undefined;
	} catch {
		return undefined;
	}
};

export const registerCreateImage = (server: McpServer, ai: Ai, options?: AiOptions) =>
	server.registerTool(
		'create_image',
		{
			title: 'Create image',
			description: 'Generate an image from a prompt. The reply links to the generated image rather than carrying it.',
			inputSchema,
		},
		async ({ prompt, model, ...generation }) => {
			const answer = await ai.run(model, { prompt, ...generation }, options);
			const link = linkFrom(answer);
			const asked = generation.output_format ? MIME_TYPES[generation.output_format] : undefined;

			return {
				content: [
					{
						type: 'resource_link',
						uri: link,
						name: 'generated-image',
						title: prompt,
						mimeType: (await storedEncodingOf(link)) ?? asked,
					},
				],
			};
		},
	);
