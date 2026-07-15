import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { resolveCurrentMember } from '$lib/server/auth-session';

export const load: LayoutServerLoad = async (event) => {
	const resolved = await resolveCurrentMember(event);
	if (!resolved) {
		redirect(303, '/login');
	}
	return resolved;
};
