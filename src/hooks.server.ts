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
	 * `getSession()` only decodes the session from cookies — it doesn't
	 * verify the JWT with the Auth server, so it isn't safe to trust for
	 * authorization decisions. `getUser()` revalidates on every call. This
	 * helper does both: cheap short-circuit when there's no session, real
	 * verification when there is one.
	 */
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) return { session: null, user: null };

		return { session, user };
	};

	const { session } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.member = null;

	if (session?.user) {
		const { data: member } = await event.locals.supabase
			.from('inventory_team_members')
			.select('*')
			.eq('supabase_auth_id', session.user.id)
			.maybeSingle();
		event.locals.member = member;
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
		const { data: setting } = await event.locals.supabase
			.from('inventory_employee_settings')
			.select('value')
			.eq('employee_id', event.locals.member.id)
			.eq('key', THEME_SETTING_KEY)
			.maybeSingle();

		if (isValidTheme(setting?.value)) {
			theme = setting.value;
		}

		event.cookies.set(THEME_COOKIE, theme, {
			path: '/',
			maxAge: THEME_COOKIE_MAX_AGE,
			httpOnly: true,
			sameSite: 'lax'
		});
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		},
		transformPageChunk: ({ html }) => html.replace('%theme.class%', theme === 'dark' ? 'dark' : '')
	});
};
