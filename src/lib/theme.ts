/**
 * Shared theme constants — used by hooks.server.ts (resolves + injects the
 * theme class server-side, no flash of the wrong theme), the /api/theme
 * endpoint (persists it), and the client-side store (applies it live).
 */

export type Theme = 'light' | 'dark';

export const DEFAULT_THEME: Theme = 'dark';

/** Fast-path cache of the DB preference, read on every request. */
export const THEME_COOKIE = 'lf_theme';
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year — a preference, not a session

/**
 * Key in `inventory_employee_settings` (the same per-employee key/value
 * table lf-scan uses for its own settings, e.g. `kiosk_mode`,
 * `scan_trigger_mode`). Prefixed with `web_` specifically so it can never
 * collide with whatever key the Android app might use for its own theme —
 * each app's appearance preference is independent.
 */
export const THEME_SETTING_KEY = 'web_theme';

export function isValidTheme(value: unknown): value is Theme {
	return value === 'light' || value === 'dark';
}
