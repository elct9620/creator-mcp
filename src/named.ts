/**
 * A key a model's request left unnamed is one that model was never asked for,
 * so it is dropped rather than sent as null. What each provider does with a
 * parameter it documents as required but defaulted is its own business; this
 * sends only what the caller actually asked.
 */
export const named = (inputs: Record<string, unknown>) =>
	Object.fromEntries(Object.entries(inputs).filter(([, value]) => value !== undefined));
