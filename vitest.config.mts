import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
