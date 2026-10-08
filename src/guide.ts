import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import geminiTts from './guides/gemini-tts.md';

/** A guide as a caller meets it: a name, the line saying what it is for, and the rest. */
type Guide = { name: string; description: string; body: string };

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/;

/**
 * Reads a guide's front matter, which holds its name and what it is for and
 * nothing else. Anything missing is a guide written wrong, so it fails as the
 * Worker loads rather than as a caller reads it.
 */
const guideFrom = (file: string): Guide => {
	const match = FRONT_MATTER.exec(file);
	const fields = Object.fromEntries(
		(match?.[1] ?? '').split('\n').map((line) => {
			const colon = line.indexOf(':');

			return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
		}),
	);
	if (!match || !fields.name || !fields.description) throw new Error('A guide needs front matter stating its name and description.');

	return { name: fields.name, description: fields.description, body: file.slice(match[0].length).trim() };
};

const GUIDES = [geminiTts].map(guideFrom);

const names = GUIDES.map(({ name }) => name) as [string, ...string[]];

const BODIES: Record<string, string> = Object.fromEntries(GUIDES.map(({ name, body }) => [name, body]));

export const registerReadGuide = (server: McpServer) =>
	server.registerTool(
		'read_guide',
		{
			title: 'Read guide',
			description: [
				'Read how to use the other tools beyond what their own descriptions say. The guides are:',
				...GUIDES.map(({ name, description }) => `- ${name}: ${description}`),
			].join('\n'),
			inputSchema: z.object({ name: z.enum(names).describe('The guide to read.') }),
		},
		async ({ name }) => ({
			content: [{ type: 'text', text: BODIES[name] }],
		}),
	);
