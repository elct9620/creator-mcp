import { createMiddleware } from 'hono/factory';

// Hono declares an ExecutionContext of its own, and Access puts nothing on
// that one. The context the runtime hands the Worker is where the match lands.
const matchedBy = (executionCtx: unknown) => (executionCtx as ExecutionContext).access;

/**
 * Turns away anything Cloudflare Access did not match. Access is attached to
 * this Worker, so a request that arrives without a match reached the origin by
 * some other path, and Managed OAuth is only safe to enable on a server that
 * says no to those.
 */
export const accessGuard = createMiddleware(async (c, next) => (matchedBy(c.executionCtx) ? next() : c.text('Unauthorized', 401)));
