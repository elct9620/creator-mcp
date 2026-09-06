import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/** Cloudflare Access hands the origin the identity it resolved in this header. */
const ASSERTION_HEADER = 'Cf-Access-Jwt-Assertion';

// One key set per team domain: jose caches the fetched keys inside the set, so
// building a new one per request would fetch them again every time.
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const keySetFor = (teamDomain: string) => {
	const cached = keySets.get(teamDomain);
	if (cached) return cached;

	const keySet = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
	keySets.set(teamDomain, keySet);
	return keySet;
};

const isEnabled = (value: string): boolean => value === 'true';

/**
 * Rejects anything Cloudflare Access did not let through. Access sits in front
 * of the deployed hostname, but a request that reaches the origin by another
 * path carries no assertion, and Managed OAuth is only safe to enable on a
 * server that checks the one it is given.
 */
export const accessGuard = () =>
	createMiddleware<{ Bindings: Env }>(async (c, next) => {
		// Local development has no Access in front of the Worker.
		if (isEnabled(c.env.DEBUG)) return next();

		const assertion = c.req.header(ASSERTION_HEADER);
		if (!assertion) return c.text('Unauthorized', 401);

		try {
			await jwtVerify(assertion, keySetFor(c.env.TEAM_DOMAIN), {
				issuer: c.env.TEAM_DOMAIN,
				audience: c.env.POLICY_AUD,
			});
		} catch {
			return c.text('Unauthorized', 401);
		}

		return next();
	});
