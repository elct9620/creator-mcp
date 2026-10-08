import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { nameAsked, type Backup } from './backup';
import { named } from './named';
import { carriedFrom, linkFrom, storedEncodingOf, type Carried } from './stored';

/** The models this tool speaks with. */
const MODELS = ['openai/tts-1', 'elevenlabs/eleven-v3', 'google/gemini-3.8-flash-tts', 'google/gemini-3.8-flash-lite-tts'] as const;

/**
 * Chosen for how it sounds rather than for what it costs: its Mandarin comes
 * closest to how people in Taiwan speak. `openai/tts-1` is cheaper for Chinese,
 * charging by the character where this charges by the second of audio. It can
 * be asked with nothing but text, which whatever is the default has to be.
 */
const DEFAULT_MODEL = 'google/gemini-3.8-flash-lite-tts';

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

/** The same map read the other way: what a file holding this encoding is called. */
const EXTENSIONS: Record<string, string> = Object.fromEntries(Object.entries(MIME_TYPES).map(([format, mime]) => [mime, format]));

/** A request on its way to one model: the caller's words, part-way translated. */
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
	/** The range it can be asked to speak within, or `false` where it speaks at one pace only. */
	speed: false | { min: number; max: number };
	/** The request in the model's own vocabulary. */
	request: (spoken: Spoken) => Record<string, unknown>;
};

/**
 * Both Gemini models take the same words. They always answer in WAV and have
 * no word for an encoding, so `wav` is the one this tool can ask for, and it
 * is never sent.
 */
const GEMINI: Speaker = {
	limit: 10000,
	voice: 'default',
	voices: [
		'Zephyr',
		'Puck',
		'Charon',
		'Kore',
		'Fenrir',
		'Leda',
		'Orus',
		'Aoede',
		'Callirrhoe',
		'Autonoe',
		'Enceladus',
		'Iapetus',
		'Umbriel',
		'Algieba',
		'Despina',
		'Erinome',
		'Algenib',
		'Rasalgethi',
		'Laomedeia',
		'Achernar',
		'Alnilam',
		'Schedar',
		'Gacrux',
		'Pulcherrima',
		'Achird',
		'Zubenelgenubi',
		'Vindemiatrix',
		'Sadachbia',
		'Sadaltager',
		'Sulafat',
	],
	formats: { wav: 'wav' },
	speed: false,
	request: ({ text, voice }) => ({ text, voice }),
};

const SPEAKERS: Record<Model, Speaker> = {
	'openai/tts-1': {
		limit: 4096,
		voice: 'default',
		voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
		formats: { mp3: 'mp3', opus: 'opus', wav: 'wav', aac: 'aac', flac: 'flac' },
		speed: { min: 0.25, max: 4 },
		request: ({ text, voice, format, speed }) => ({ text, voice, response_format: format, speed }),
	},
	'elevenlabs/eleven-v3': {
		limit: 10000,
		voice: 'required',
		formats: { mp3: 'mp3_44100_128', opus: 'opus_48000_128' },
		speed: false,
		request: ({ text, voice, format }) => ({ text, voice_id: voice, output_format: format }),
	},
	'google/gemini-3.8-flash-tts': GEMINI,
	'google/gemini-3.8-flash-lite-tts': GEMINI,
};

const inputSchema = z.object({
	text: z
		.string()
		.describe('What should be spoken, word for word. For more on how a model can be steered through it, read the guides with read_guide.'),
	model: z
		.enum(MODELS)
		.default(DEFAULT_MODEL)
		.describe(
			'The model to speak with. google/gemini-3.8-flash-lite-tts sounds closest to Mandarin as spoken in Taiwan, and ' +
				'google/gemini-3.8-flash-tts pronounces most exactly at a higher price. openai/tts-1 is charged by the character ' +
				'where the Gemini models are charged by the second, which makes it the cheapest for Chinese.',
		),
	voice: z
		.string()
		.optional()
		.describe(
			'Which voice speaks. openai/tts-1 names one of alloy, echo, fable, onyx, nova or shimmer. ' +
				`The Gemini models name one of ${GEMINI.voices?.join(', ')}. ` +
				'elevenlabs/eleven-v3 takes an ElevenLabs voice ID, and requires one.',
		),
	format: z
		.enum(FORMATS)
		.optional()
		.describe('The encoding the audio is in. elevenlabs/eleven-v3 stores only mp3 or opus. The Gemini models store only wav.'),
	speed: z.number().optional().describe('How fast the voice speaks. Only openai/tts-1 can vary it, between 0.25 and 4.'),
	name: nameAsked,
});

const outputSchema = z.object({
	uri: z.string().optional().describe('Where the generated audio is stored, when the model stored it rather than handing it over.'),
	mime_type: z.string().optional().describe('What the audio is encoded as, when it can be known.'),
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

	if (speed !== undefined && speaker.speed && (speed < speaker.speed.min || speed > speaker.speed.max))
		throw new Error(`${model} speaks between ${speaker.speed.min} and ${speaker.speed.max} times its own pace.`);
};

/**
 * The reply for audio the model handed over rather than stored: there is no
 * link to state, so the audio itself is carried, and a text block still says
 * so for a client that shows nothing for audio content.
 */
const carriedReply = ({ data, mimeType }: Carried) => ({
	content: [
		{ type: 'audio' as const, data, mimeType },
		{ type: 'text' as const, text: `The audio is carried in this reply as ${mimeType}. There is no link to it, so save it from here.` },
	],
	structuredContent: { mime_type: mimeType },
});

export const registerCreateAudio = (server: McpServer, ai: Ai, backup: Backup | undefined, options?: AiOptions) =>
	server.registerTool(
		'create_audio',
		{
			title: 'Create audio',
			description:
				'Speak text aloud with a text-to-speech model. The reply links to the generated audio, or carries it ' +
				'when the model hands the audio over rather than storing it.',
			inputSchema,
			outputSchema,
		},
		async ({ model, name, ...asked }) => {
			refuseWhatItCannotDo(model, asked);

			const speaker = SPEAKERS[model];
			const stored = asked.format ? speaker.formats[asked.format] : undefined;
			const answer = await ai.run(model, named(speaker.request({ ...asked, format: stored })), options);

			const carried = carriedFrom(answer, 'audio');
			if (carried) {
				await backup?.(carried, { extension: EXTENSIONS[carried.mimeType], name });

				return carriedReply(carried);
			}

			const link = linkFrom(answer, 'audio');
			const fallback = asked.format ? MIME_TYPES[asked.format] : undefined;
			const mimeType = (await storedEncodingOf(link)) ?? fallback;
			const copy = await backup?.(link, { extension: mimeType ? EXTENSIONS[mimeType] : undefined, name });
			const delivered = copy ?? link;

			return {
				content: [
					{
						type: 'resource_link',
						uri: delivered,
						name: 'generated-audio',
						mimeType,
					},
					{
						type: 'text',
						text: `The audio is at ${delivered}. That link works for about a day, so save the file before then.`,
					},
				],
				structuredContent: { uri: delivered, mime_type: mimeType },
			};
		},
	);
