/**
 * What the models this application generates with have in common: each stores
 * what it made and answers with a link to it, and the link is the whole of
 * what the reply carries. Reading that link out of the answer, and asking the
 * store what it holds, is the same work whichever tool asked.
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * The answer is the gateway's envelope around the model's own output, and none
 * of these models is in `AiModels`, so the binding types it as an open record
 * and nothing upstream would catch a shape that changed. This is the one place
 * stating what the answer has to carry. The envelope carries a `state`, and
 * `gatewayMetadata` on some answers but not others; the link is the whole of
 * what is read.
 */
export const linkFrom = (answer: Record<string, unknown>, kind: 'image' | 'audio'): string => {
	const link = isRecord(answer.result) ? answer.result[kind] : undefined;
	if (typeof link !== 'string') throw new Error(`The model answered without a link to the ${kind}.`);

	return link;
};

// Long enough for a store that is answering, short enough that one which is
// not leaves the reply to the format the caller asked for instead of waiting.
const ENCODING_TIMEOUT_MS = 5000;

/**
 * What the stored file is really encoded as. A caller's output format is a
 * hint the model may not honour, so the store is asked rather than trusted to
 * have obeyed. One byte answers it: the range keeps the file out of the
 * Worker while the response states its type, and the link is signed for `GET`
 * alone, so a `HEAD` would be refused.
 */
export const storedEncodingOf = async (link: string): Promise<string | undefined> => {
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
