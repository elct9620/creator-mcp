/**
 * The binding this repository does not declare.
 *
 * AI_GATEWAY is the deployment's answer rather than the repository's, so it
 * arrives as a secret, and the generated types carry it only on a machine whose
 * .dev.vars happens to name one. Stating it here is what keeps every other
 * machine compiling. Stating it optional is what a deployment looks like: one
 * that names no gateway leaves the secret unset, and the binding is then absent
 * rather than empty.
 */
interface Env {
	AI_GATEWAY?: string;
}
