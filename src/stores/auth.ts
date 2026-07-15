import { writable } from 'svelte/store';
import type { TeamMember } from '$lib/types';

export interface CurrentUser {
	employeeId: string;
	employeeName: string;
	employeeRole: string;
}

function createCurrentUserStore() {
	const { subscribe, set } = writable<CurrentUser | null>(null);

	return {
		subscribe,
		/** Populate the store from the team member resolved in (app)/+layout.server.ts. */
		setFromMember(member: TeamMember | null) {
			set(
				member
					? { employeeId: member.id, employeeName: member.name, employeeRole: member.role }
					: null
			);
		},
		clear() {
			set(null);
		}
	};
}

export const currentUser = createCurrentUserStore();
