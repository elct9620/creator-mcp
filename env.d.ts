/**
 * The binding `wrangler types` cannot see.
 *
 * AI_GATEWAY is the deployment's answer rather than the repository's, so no
 * configuration file declares it and nothing is generated for it. It is
 * optional because a deployment that names no gateway leaves the secret unset,
 * and the binding is then absent rather than empty.
 */
interface Env {
	AI_GATEWAY?: string;
}
