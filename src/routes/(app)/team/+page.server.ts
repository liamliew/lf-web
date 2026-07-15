import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createSupabaseAdminClient } from '$lib/supabase-server';

export const actions: Actions = {
	linkAccount: async ({ request }) => {
		const formData = await request.formData();
		const memberId = String(formData.get('memberId') ?? '');
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();

		if (!memberId || !email) {
			return fail(400, { memberId, linkError: 'Enter an email address' });
		}

		const admin = createSupabaseAdminClient();

		// The admin API has no "get user by email" endpoint — list and match.
		// Fine at LF Creative's team size; would need pagination past ~1000 users.
		const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
			perPage: 1000
		});
		if (listError) {
			return fail(500, { memberId, linkError: 'Failed to look up account. Try again.' });
		}

		const authUser = usersPage.users.find((u) => u.email?.toLowerCase() === email);
		if (!authUser) {
			return fail(404, {
				memberId,
				linkError:
					'No account found with that email. The employee must sign in with Google/Microsoft first before their account can be linked.'
			});
		}

		const { error: updateError } = await admin
			.from('inventory_team_members')
			.update({ supabase_auth_id: authUser.id })
			.eq('id', memberId);
		if (updateError) {
			return fail(500, { memberId, linkError: 'Failed to link account. Try again.' });
		}

		return { memberId, linked: true, authUserId: authUser.id };
	},

	unlinkAccount: async ({ request }) => {
		const formData = await request.formData();
		const memberId = String(formData.get('memberId') ?? '');
		if (!memberId) {
			return fail(400, { memberId, linkError: 'Missing member id' });
		}

		const admin = createSupabaseAdminClient();
		const { error } = await admin
			.from('inventory_team_members')
			.update({ supabase_auth_id: null })
			.eq('id', memberId);
		if (error) {
			return fail(500, { memberId, linkError: 'Failed to unlink account. Try again.' });
		}

		return { memberId, unlinked: true };
	}
};
