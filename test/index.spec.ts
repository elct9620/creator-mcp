import { exports } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';

describe('routing', () => {
	// @behavior R-001
	it('should answer Coming Soon when the root is requested', async () => {
		const response = await exports.default.fetch('https://creator.example.com/');

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('Coming Soon');
	});

	// @behavior R-002
	it('should answer 404 when no route serves the path', async () => {
		const response = await exports.default.fetch('https://creator.example.com/nothing-here');

		expect(response.status).toBe(404);
	});
});
