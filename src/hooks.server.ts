import { createSupabaseServerClient } from '$lib/supabase-server';
import {
	DEFAULT_THEME,
	THEME_COOKIE,
	THEME_COOKIE_MAX_AGE,
	THEME_SETTING_KEY,
	isValidTheme,
	type Theme
} from '$lib/theme';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event.cookies);

	/**
	 * `getUser()` revalidates the user with the Supabase Auth server, ensuring
	 * data authenticity and avoiding warnings about relying on unverified cookie session state.
	 */
	event.locals.safeGetSession = async () => {
		try {
			const {
				data: { user },
				error
			} = await event.locals.supabase.auth.getUser();
			if (error || !user) return { session: null, user: null };

			const {
				data: { session }
			} = await event.locals.supabase.auth.getSession();

			return { session, user };
		} catch (err) {
			console.error('Error in safeGetSession:', err);
			return { session: null, user: null };
		}
	};

	let session = null;
	let user = null;
	try {
		const res = await event.locals.safeGetSession();
		session = res.session;
		user = res.user;
	} catch (err) {
		console.error('Error resolving session in hooks:', err);
	}

	event.locals.session = session;
	event.locals.user = user;
	event.locals.member = null;

	if (user) {
		try {
			const { data: member } = await event.locals.supabase
				.from('inventory_team_members')
				.select('*')
				.eq('supabase_auth_id', user.id)
				.maybeSingle();
			event.locals.member = member;
		} catch (err) {
			console.error('Error fetching team member in hooks:', err);
		}
	}

	/**
	 * Theme resolution — cookie is the fast path (no DB call) on every
	 * request. It's only missing on a user's first request ever, or after
	 * they've cleared cookies, in which case we do a one-time lookup against
	 * their saved preference and re-seed the cookie so subsequent requests
	 * skip the DB entirely.
	 */
	let theme: Theme = DEFAULT_THEME;
	const cookieTheme = event.cookies.get(THEME_COOKIE);
	if (isValidTheme(cookieTheme)) {
		theme = cookieTheme;
	} else if (event.locals.member) {
		try {
			const { data: setting } = await event.locals.supabase
				.from('inventory_employee_settings')
				.select('value')
				.eq('employee_id', event.locals.member.id)
				.eq('key', THEME_SETTING_KEY)
				.maybeSingle();

			if (isValidTheme(setting?.value)) {
				theme = setting.value;
			}
		} catch (err) {
			console.error('Error fetching theme setting in hooks:', err);
		}

		try {
			event.cookies.set(THEME_COOKIE, theme, {
				path: '/',
				maxAge: THEME_COOKIE_MAX_AGE,
				httpOnly: true,
				sameSite: 'lax'
			});
		} catch {
			// ignore cookie set failure
		}
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		},
		transformPageChunk: ({ html }) => html.replace('%theme.class%', theme === 'dark' ? 'dark' : '')
	});
};
