// What Access resolved about a caller it matched: the application, and the
// claims `getIdentity()` answers with.
const MATCHED = {
	app_aud: 'stand-in-audience',
	jwt_claims: { email: 'someone@example.com' },
};

// A match an identity provider gave no address with. Access still matched the
// request, so the endpoint answers it; what needs an address does not run.
const NAMELESS = {
	app_aud: 'stand-in-audience',
	jwt_claims: {},
};

const ACCESS_BLOB = 'MF-Access-Blob';

/**
 * How a request says Cloudflare Access matched it. workerd reads this header
 * and builds `ctx.access` from it itself, so no test stands in for the context
 * at all — but only because the `access.dev` block in wrangler.jsonc turns
 * that reading on. That block answers `wrangler dev`, and the pool reads it
 * too.
 *
 * The name is miniflare's own `CoreHeaders.ACCESS_BLOB`. Nothing in
 * `cloudflare:test` simulates Access, so there is no documented seam to reach
 * for instead; if the name moves, A-002 answers 401 and says so.
 */
export const asMatched = (request: Request) => {
	request.headers.set(ACCESS_BLOB, JSON.stringify(MATCHED));

	return request;
};

/** The same, for a caller Access matched without resolving an address. */
export const asNameless = (request: Request) => {
	request.headers.set(ACCESS_BLOB, JSON.stringify(NAMELESS));

	return request;
};
