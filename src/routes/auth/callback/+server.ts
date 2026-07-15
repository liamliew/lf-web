import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');

	if (code) {
		await locals.supabase.auth.exchangeCodeForSession(code);

		// After OAuth, check if this user has a team member record.
		const {
			data: { user }
		} = await locals.supabase.auth.getUser();

		if (user) {
			const { data: member } = await locals.supabase
				.from('inventory_team_members')
				.select('id')
				.eq('supabase_auth_id', user.id)
				.maybeSingle();

			if (!member) {
				// Authenticated via OAuth but not registered as a team member —
				// sign out immediately so no session is left behind, then bounce
				// back to login with an error an admin can act on.
				await locals.supabase.auth.signOut();
				redirect(303, '/login?error=not_registered');
			}
		}
	}

	redirect(303, '/assets');
};
