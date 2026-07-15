import { supabase } from '$lib/supabase';
import type { CreateTeamMemberInput, TeamMember } from '$lib/types';

export async function getTeamMembers(): Promise<TeamMember[]> {
	const { data, error } = await supabase
		.from('inventory_team_members')
		.select('*')
		.order('name', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function createTeamMember(data: CreateTeamMemberInput): Promise<TeamMember> {
	const { data: member, error } = await supabase
		.from('inventory_team_members')
		.insert(data)
		.select('*')
		.single();
	if (error) throw error;
	return member;
}

export async function updateTeamMember(id: string, data: Partial<TeamMember>): Promise<TeamMember> {
	const { data: member, error } = await supabase
		.from('inventory_team_members')
		.update(data)
		.eq('id', id)
		.select('*')
		.single();
	if (error) throw error;
	return member;
}

export async function deleteTeamMember(id: string): Promise<void> {
	const { count, error: countError } = await supabase
		.from('inventory_assets')
		.select('*', { count: 'exact', head: true })
		.eq('current_user_id', id)
		.neq('status', 'available');
	if (countError) throw countError;
	if (count && count > 0) {
		throw new Error('Cannot delete a team member with assets currently checked out.');
	}

	const { error } = await supabase.from('inventory_team_members').delete().eq('id', id);
	if (error) throw error;
}

export async function getAssetsCheckedOutCount(memberId: string): Promise<number> {
	const { count, error } = await supabase
		.from('inventory_assets')
		.select('*', { count: 'exact', head: true })
		.eq('current_user_id', memberId)
		.eq('status', 'checked_out');
	if (error) throw error;
	return count ?? 0;
}
