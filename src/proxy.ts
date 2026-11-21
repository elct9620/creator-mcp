/**
 * Running a model on a payload the caller wrote, and handing back whatever the
 * model answered. Nothing is translated either way: the body is the model's
 * own input and the response is the model's own answer.
 */

/** Where Cloudflare states what a model takes; the model's id is the path. */
const schemaOf = (model: string) => `https://developers.cloudflare.com/ai/models/${model}/schema-input.json`;

/** What a caller who got the body wrong reads next, so they correct it without first finding where the rules are. */
const pointerFor = (model: string) => `What ${model} takes is described at ${schemaOf(model)}. How to call this endpoint is at GET /api.`;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const inputsOf = async (request: Request): Promise<unknown> => {
	try {
		return await request.json();
	} catch {
		return undefined;
	}
};

/**
 * Every failure of the model answers 502: a body the model refused and an
 * upstream that broke reach here as the same thrown error, so a status telling
 * them apart would be a guess. The message is the model's own.
 */
export const runModel = async (ai: Ai, model: string, request: Request, options?: AiOptions): Promise<Response> => {
	const inputs = await inputsOf(request);
	if (!isObject(inputs)) return new Response(`The body has to be a JSON object.\n\n${pointerFor(model)}`, { status: 400 });

	let answer: unknown;
	try {
		answer = await ai.run(model, inputs, options);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		return new Response(`${message}\n\n${pointerFor(model)}`, { status: 502 });
	}

	return answer instanceof ReadableStream ? new Response(answer) : Response.json(answer);
};
