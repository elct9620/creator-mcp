/**
 * Workers AI has no local simulation and bills the account on every call, so
 * no test may hold a binding that can reach it. This stands in for one and
 * refuses: a call arriving here is a test about to spend money, and the
 * failure is what makes that visible instead of silent.
 *
 * `Ai` is an abstract class with far more surface than any test touches, so
 * the stand-in is narrowed rather than implemented.
 */
export const unreachableAi = () =>
	({
		run: () => {
			throw new Error('Workers AI is unreachable from tests. Hand the endpoint an AI that answers instead.');
		},
	}) as unknown as Ai;
