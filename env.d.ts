/**
 * The bindings this repository does not declare.
 *
 * Each is the deployment's answer rather than the repository's, so each arrives
 * as a secret, and the generated types carry one only on a machine whose
 * .dev.vars happens to name it. Stating them here is what keeps every other
 * machine compiling. Stating them optional is what a deployment looks like: one
 * that answers nothing leaves the secret unset, and the binding is then absent
 * rather than empty.
 */
interface Env {
	/** The AI Gateway inference is reached through. Unset leaves the account's default one to answer. */
	AI_GATEWAY?: string;
	/** Whether generated files are copied into the bucket. Only `yes` turns it on. */
	BACKUP?: string;
	/**
	 * The time zone the date in a backup's path is read in. Unset is UTC, which
	 * is also what the runtime itself always keeps, so nothing else moves with
	 * this: it names the folder a file lands in and nothing more.
	 */
	TZ?: string;
}

/** A Markdown file, which the `Text` rule in wrangler.jsonc hands over as its contents. */
declare module '*.md' {
	const text: string;
	export default text;
}
