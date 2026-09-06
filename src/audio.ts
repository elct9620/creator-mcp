import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { linkFrom, storedEncodingOf } from './stored';

/**
 * The models this tool speaks with. Each one answers with a link to what it
 * stored rather than with the audio itself; a model that returns audio bytes
 * would need a different reply and does not belong on this list.
 */
const MODELS = ['openai/tts-1', 'elevenlabs/eleven-v3'] as const;

/**
 * The one model that can be asked with nothing but text: it has a voice of its
 * own, where `elevenlabs/eleven-v3` has to be told an ElevenLabs voice ID.
 */
const DEFAULT_MODEL = 'openai/tts-1';

/**
 * The encodings this tool speaks of. Raw PCM is deliberately absent: it has no
 * container, so a store holding it has nothing to say about what it is, and
 * the reply would have no encoding to state.
 */
const FORMATS = ['mp3', 'opus', 'wav', 'aac', 'flac'] as const;

type Model = (typeof MODELS)[number];
type Format = (typeof FORMATS)[number];

const MIME_TYPES: Record<Format, string> = {
	mp3: 'audio/mpeg',
	opus: 'audio/ogg',
	wav: 'audio/wav',
	aac: 'audio/aac',
	flac: 'audio/flac',
};

/** What a caller asks for, in this tool's words rather than a provider's. */
type Spoken = {
	text: string;
	voice?: string;
	/** Already in the model's own name for it, because only the speaker knows that name. */
	format?: string;
	speed?: number;
};

/**
 * What one model can be asked for, and what it calls each thing. Providers name
 * the same idea differently and cannot always do it at all, so the tool keeps
 * one vocabulary and every speaker states how much of it it answers to.
 */
type Speaker = {
	/** How long a text this model will take. */
	limit: number;
	/** Whether the model brings a voice of its own or has to be told one. */
	voice: 'required' | 'default';
	/** The voices it answers to, where they are a closed set. An ElevenLabs voice ID is drawn from an open one, so there is nothing to list. */
	voices?: readonly string[];
	/** Which of this tool's formats it can store, and what it calls each. */
	formats: Partial<Record<Format, string>>;
	/** Whether it can be asked to speak faster or slower. */
	speed: boolean;
	/** The request in the model's own vocabulary. */
	request: (spoken: Spoken) => Record<string, unknown>;
};

const SPEAKERS: Record<Model, Speaker> = {
	'openai/tts-1': {
		limit: 4096,
		voice: 'default',
		voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
		formats: { mp3: 'mp3', opus: 'opus', wav: 'wav', aac: 'aac', flac: 'flac' },
		speed: true,
		request: ({ text, voice, format, speed }) => ({ text, voice, response_format: format, speed }),
	},
	'elevenlabs/eleven-v3': {
		limit: 10000,
		voice: 'required',
		formats: { mp3: 'mp3_44100_128', opus: 'opus_48000_128' },
		speed: false,
		request: ({ text, voice, format }) => ({ text, voice_id: voice, output_format: format }),
	},
};

/**
 * A key a speaker left unnamed is one that model was never asked for, so it is
 * dropped rather than sent as null. What each provider does with a parameter it
 * documents as required but defaulted is its own business; this sends only what
 * the caller actually asked.
 */
const named = (inputs: Record<string, unknown>) => Object.fromEntries(Object.entries(inputs).filter(([, value]) => value !== undefined));

const inputSchema = z.object({
	text: z.string().describe('What should be spoken.'),
	model: z.enum(MODELS).default(DEFAULT_MODEL).describe('The model to speak with.'),
	voice: z
		.string()
		.optional()
		.describe(
			'Which voice speaks. openai/tts-1 names one of alloy, echo, fable, onyx, nova or shimmer. ' +
				'elevenlabs/eleven-v3 takes an ElevenLabs voice ID, and requires one.',
		),
	format: z.enum(FORMATS).optional().describe('The encoding the audio is stored in. elevenlabs/eleven-v3 stores only mp3 or opus.'),
	speed: z.number().min(0.25).max(4).optional().describe('How fast the voice speaks. Only openai/tts-1 can vary it.'),
});

const outputSchema = z.object({
	uri: z.string().describe('Where the generated audio is stored.'),
	mime_type: z.string().optional().describe('What the stored audio is encoded as, when it can be known.'),
});

/** What a caller said, in this tool's words. */
type Asked = Omit<z.infer<typeof inputSchema>, 'model'>;

/**
 * A request the chosen model cannot honour is refused before it is sent,
 * because the alternative is audio that quietly is not what was asked for: a
 * speed that was ignored, an encoding that fell back to the model's own. Each
 * refusal names the way out, so a caller can ask again rather than only be
 * told no.
 *
 * It is thrown from the call rather than declared in the schema. The constraint
 * is per model and a tool's `inputSchema` is a single JSON Schema object, so
 * there is nowhere in the advertised shape to put it; thrown, it comes back as
 * a tool error carrying the sentence, which is the form that reaches the model
 * that called.
 */
const refuseWhatItCannotDo = (model: Model, { text, voice, format, speed }: Asked) => {
	const speaker = SPEAKERS[model];

	if (text.length > speaker.limit) throw new Error(`${model} speaks at most ${speaker.limit} characters, and this text is ${text.length}.`);

	if (voice === undefined && speaker.voice === 'required') throw new Error(`${model} brings no voice of its own. Name one in \`voice\`.`);

	if (voice !== undefined && speaker.voices && !speaker.voices.includes(voice))
		throw new Error(`${model} has no voice called ${voice}. It speaks as ${speaker.voices.join(', ')}.`);

	if (format !== undefined && speaker.formats[format] === undefined)
		throw new Error(`${model} cannot store ${format}. It stores ${Object.keys(speaker.formats).join(', ')}.`);

	// Asking a model that always speaks at its own pace for that same pace is a
	// request it already meets, so it is let through and dropped in translation
	// rather than refused.
	if (speed !== undefined && speed !== 1 && !speaker.speed)
		throw new Error(`${model} cannot vary how fast it speaks. Drop \`speed\`, or speak with a model that can.`);
};

export const registerCreateAudio = (server: McpServer, ai: Ai, options?: AiOptions) =>
	server.registerTool(
		'create_audio',
		{
			title: 'Create audio',
			description: 'Speak text aloud with a text-to-speech model. The reply links to the generated audio rather than carrying it.',
			inputSchema,
			outputSchema,
		},
		async ({ model, ...asked }) => {
			refuseWhatItCannotDo(model, asked);

			const speaker = SPEAKERS[model];
			const stored = asked.format ? speaker.formats[asked.format] : undefined;
			const answer = await ai.run(model, named(speaker.request({ ...asked, format: stored })), options);
			const link = linkFrom(answer, 'audio');
			const fallback = asked.format ? MIME_TYPES[asked.format] : undefined;
			const mimeType = (await storedEncodingOf(link)) ?? fallback;

			return {
				content: [
					{
						type: 'resource_link',
						uri: link,
						name: 'generated-audio',
						mimeType,
					},
					{
						type: 'text',
						text: `The audio is at ${link}. That link works for about a day, so save the file before then.`,
					},
				],
				structuredContent: { uri: link, mime_type: mimeType },
			};
		},
	);
