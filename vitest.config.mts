import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Every test file loads the Worker afresh, and left alone that means
		// transforming each of these packages module by module, every time —
		// most of what a run spends. Bundled once into a file apiece, they load
		// as a whole instead.
		// https://vitest.dev/guide/profiling-test-performance.html
		deps: {
			optimizer: {
				ssr: {
					enabled: true,
					include: ['@modelcontextprotocol/server', '@modelcontextprotocol/client', 'zod', 'hono', 'msw', '@msw/cloudflare'],
				},
			},
		},
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
