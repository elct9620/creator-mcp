import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: './wrangler.jsonc' },
			// The pool derives bindings from wrangler.jsonc, which pulls in a
			// local .dev.vars. Stating them here overrides that, so the suite
			// answers to this file rather than to whatever each machine has —
			// a local DEBUG=true would otherwise run every test through the
			// Access bypass and still report green.
			miniflare: {
				bindings: {
					DEBUG: 'false',
					TEAM_DOMAIN: 'https://creator.cloudflareaccess.com',
					POLICY_AUD: 'test-policy-aud',
				},
			},
		}),
	],
});
