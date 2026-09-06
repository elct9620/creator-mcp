/**
 * Workers AI has no local simulation and bills the account on every call, so
 * no test may hold a binding that can reach it. These stand in for one.
 *
 * `Ai` is an abstract class with far more surface than any test touches, so
 * each stand-in is narrowed rather than implemented.
 */

/**
 * Refuses rather than answers: a call arriving here is a test about to spend
 * money, and the failure is what makes that visible instead of silent.
 */
export const unreachableAi = () =>
	({
		run: () => {
			throw new Error('Workers AI is unreachable from tests. Hand the endpoint an AI that answers instead.');
		},
	}) as unknown as Ai;

export type Generation = { model: string; inputs: Record<string, unknown>; options?: AiOptions };

/**
 * Answers every call with `answer` and records what it was asked, which is
 * how a test says what reached the model without reaching the model.
 */
export const aiAnswering = (answer: Record<string, unknown>) => {
	const generations: Generation[] = [];

	return {
		generations,
		ai: {
			run: (model: string, inputs: Record<string, unknown>, options?: AiOptions) => {
				generations.push({ model, inputs, options });

				return Promise.resolve(answer);
			},
		} as unknown as Ai,
	};
};
