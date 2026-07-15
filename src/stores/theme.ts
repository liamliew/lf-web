import { writable } from 'svelte/store';
import type { Theme } from '$lib/theme';

function createThemeStore() {
	const { subscribe, set } = writable<Theme>('dark');

	return {
		subscribe,
		/**
		 * Read the theme hooks.server.ts already applied to <html> during SSR,
		 * so the store starts in sync with what's on screen instead of
		 * guessing and causing a mismatch flash.
		 */
		init() {
			if (typeof document === 'undefined') return;
			set(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
		},
		/** Flips the live DOM class immediately, then persists in the background. */
		async apply(next: Theme) {
			if (typeof document !== 'undefined') {
				document.documentElement.classList.toggle('dark', next === 'dark');
			}
			set(next);

			try {
				await fetch('/api/theme', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ theme: next })
				});
			} catch {
				// best-effort persistence — the UI already reflects the change;
				// worst case it re-syncs from the DB on the next login.
			}
		}
	};
}

export const theme = createThemeStore();
