import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		// adapter-node produces a standalone Node server (build/index.js),
		// suitable for self-hosting behind PM2 + nginx on Proxmox.
		adapter: adapter(),

		alias: {
			$components: 'src/components',
			'$components/*': 'src/components/*',
			$stores: 'src/stores',
			'$stores/*': 'src/stores/*',
			$services: 'src/services',
			'$services/*': 'src/services/*'
		}
	}
};

export default config;
