import { cloudflareAccess } from '@hono/cloudflare-access';
import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';

const isEnabled = (value: string): boolean => value === 'true';

// The middleware holds Access's signing keys in the closure it returns, so it
// is built once per configuration rather than once per request.
const guards = new Map<string, MiddlewareHandler>();

const guardFor = (teamName: string, aud: string) => {
	const configuration = `${teamName}/${aud}`;
	let guard = guards.get(configuration);
	if (!guard) {
		guard = cloudflareAccess(teamName, aud);
		guards.set(configuration, guard);
	}
	return guard;
};

/**
 * Rejects anything Cloudflare Access did not let through. Access sits in front
 * of the deployed hostname, but a request that reaches the origin by another
 * path carries no assertion, and Managed OAuth is only safe to enable on a
 * server that checks the one it is given.
 */
export const accessGuard = () =>
	createMiddleware<{ Bindings: Env }>((c, next) => {
		// Local development has no Access in front of the Worker.
		if (isEnabled(c.env.DEBUG)) return next();

		return guardFor(c.env.TEAM_NAME, c.env.POLICY_AUD)(c, next);
	});
