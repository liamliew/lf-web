import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveCurrentMember } from '$lib/server/auth-session';

export const load: PageServerLoad = async (event) => {
	const resolved = await resolveCurrentMember(event);
	if (resolved) {
		redirect(303, '/assets');
	}

	return {
		error: event.url.searchParams.get('error')
	};
};
