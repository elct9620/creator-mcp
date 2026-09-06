import { createExecutionContext } from 'cloudflare:test';
import type { ExecutionContext as HonoExecutionContext } from 'hono';

// What Access resolved about a caller it matched: the application, and the
// claims `getIdentity()` answers with.
const MATCHED = {
	app_aud: 'stand-in-audience',
	jwt_claims: { email: 'someone@example.com' },
};

/**
 * How a request says Cloudflare Access matched it. workerd reads this header
 * and builds `ctx.access` from it itself, so a test driving the Worker through
 * its real entry never has to stand in for the context at all — but only
 * because the `access.dev` block in wrangler.jsonc turns that reading on. That
 * block answers `wrangler dev`, and the pool reads it too.
 *
 * The name is miniflare's own `CoreHeaders.ACCESS_BLOB`. Nothing in
 * `cloudflare:test` simulates Access, so there is no documented seam to reach
 * for instead; if the name moves, A-002 answers 401 and says so.
 */
export const matchedHeaders = () => ({ 'MF-Access-Blob': JSON.stringify(MATCHED) });

/**
 * The execution context for a test that cannot go through that entry — one
 * handing the app an `env` of its own, which `SELF.fetch` has no way to do.
 * The runtime still builds the context; `access` alone is stood in for,
 * because it is the one property Cloudflare puts there and no caller can.
 *
 * Hono types this parameter with an ExecutionContext of its own, which has no
 * room for what Access adds.
 */
export const arrivingMatched = () => {
	const executionCtx = createExecutionContext();
	Object.assign(executionCtx, {
		access: { aud: MATCHED.app_aud, getIdentity: async () => MATCHED.jwt_claims },
	});

	return executionCtx as unknown as HonoExecutionContext;
};
