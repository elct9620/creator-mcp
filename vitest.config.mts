import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// A file's first request also loads the Worker, which takes seconds when
		// every file loads one at once. That wait is the pool's rather than the
		// behaviour under test, so it is allowed for wherever the first request
		// happens to fall.
		testTimeout: 15_000,
	},
	plugins: [
		cloudflareTest({
			// Workers AI has no local simulation and bills the account on every
			// call, so a binding the pool can reach is a suite that spends money.
			// Remote bindings are on by default and `ai` counts itself remote
			// unless told otherwise; this closes the channel for every binding.
			// What exercises the image tool is a fake AI handed to the app.
			remoteBindings: false,
			wrangler: { configPath: './wrangler.jsonc' },
		}),
	],
});
