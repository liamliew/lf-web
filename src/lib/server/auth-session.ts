import type { RequestEvent } from '@sveltejs/kit';
import type { Session } from '@supabase/supabase-js';
import type { TeamMember } from '$lib/types';

export interface ResolvedAuth {
	session: Session | null;
	member: TeamMember;
}

/**
 * Resolves the current authenticated member from the OAuth session set by
 * hooks.server.ts on locals. Returns null if there is none — callers decide
 * what to do (redirect to /login, redirect away from /login, etc). Anything
 * under src/lib/server/ can't be imported into client-side code, so this is
 * safe to use for authorization decisions.
 */
export async function resolveCurrentMember(
	event: Pick<RequestEvent, 'locals'>
): Promise<ResolvedAuth | null> {
	const { locals } = event;

	if (locals.session && locals.member) {
		return { session: locals.session, member: locals.member };
	}

	return null;
}
