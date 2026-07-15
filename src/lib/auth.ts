import { supabase } from '$lib/supabase';
import type { TeamMember } from '$lib/types';

/**
 * Client-side PIN+password check — used by the settings page to verify the
 * current password before allowing a change.
 */
export async function authenticateEmployee(
	pin: string,
	password: string
): Promise<TeamMember | null> {
	const { data } = await supabase
		.from('inventory_team_members')
		.select('*')
		.eq('pin', pin)
		.eq('password', password)
		.maybeSingle();
	return data;
}
