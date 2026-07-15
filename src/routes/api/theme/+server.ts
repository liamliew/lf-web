import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, THEME_SETTING_KEY, isValidTheme } from '$lib/theme';

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	// Identity always comes from the server-verified session (locals.member,
	// set in hooks.server.ts) — never from anything the client submits.
	if (!locals.member) {
		error(401, 'Not authenticated');
	}

	const body = await request.json().catch(() => null);
	const theme = body?.theme;
	if (!isValidTheme(theme)) {
		error(400, 'Invalid theme');
	}

	const { error: dbError } = await locals.supabase.from('inventory_employee_settings').upsert(
		{
			employee_id: locals.member.id,
			key: THEME_SETTING_KEY,
			value: theme,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'employee_id,key' }
	);

	if (dbError) {
		error(500, 'Failed to save theme preference');
	}

	cookies.set(THEME_COOKIE, theme, {
		path: '/',
		maxAge: THEME_COOKIE_MAX_AGE,
		httpOnly: true,
		sameSite: 'lax'
	});

	return json({ theme });
};
