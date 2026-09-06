import type { ExecutionContext } from 'hono';

// What Access hands a Worker it matched. Nothing in the endpoint reads the
// identity yet; it is stated so that whatever starts reading it finds the
// shape it will really be given.
const MATCHED: CloudflareAccessContext = {
	aud: 'stand-in-audience',
	getIdentity: async () => ({ email: 'someone@example.com' }),
};

const contextWith = (access: CloudflareAccessContext | undefined) =>
	({
		waitUntil: () => {},
		passThroughOnException: () => {},
		props: {},
		access,
	}) as unknown as ExecutionContext;

/**
 * The execution context a request arrives with. Access is what puts `access`
 * on it, so leaving it off is how a test says the request was never matched.
 * Hono types this parameter with an ExecutionContext of its own, which has no
 * room for what Access adds.
 */
export const arrivingMatched = () => contextWith(MATCHED);
export const arrivingUnmatched = () => contextWith(undefined);
