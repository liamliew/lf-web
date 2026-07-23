import { supabase } from '$lib/supabase';
import type { Asset, Container, ContainerEvent, CreateContainerInput } from '$lib/types';

export interface ContainerFilters {
	status?: string;
	search?: string;
	locationId?: string;
}

export async function getContainers(filters: ContainerFilters = {}): Promise<Container[]> {
	let query = supabase.from('inventory_containers').select('*').order('name', { ascending: true });

	if (filters.status && filters.status !== 'all') {
		query = query.eq('status', filters.status);
	}
	if (filters.search) {
		query = query.or(`name.ilike.%${filters.search}%,container_id.ilike.%${filters.search}%`);
	}
	if (filters.locationId) {
		query = query.eq('current_location_id', filters.locationId);
	}

	const { data, error } = await query;
	if (error) throw error;
	return data ?? [];
}

export async function getContainer(id: string): Promise<(Container & { assets: Asset[] }) | null> {
	const { data: container, error } = await supabase
		.from('inventory_containers')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	if (error) throw error;
	if (!container) return null;

	const { data: assets, error: assetsError } = await supabase
		.from('inventory_assets')
		.select('*')
		.eq('container_id', id);
	if (assetsError) throw assetsError;

	return { ...container, assets: assets ?? [] };
}

export async function getContainerEvents(containerId: string): Promise<ContainerEvent[]> {
	const { data, error } = await supabase
		.from('inventory_container_events')
		.select('*')
		.eq('container_id', containerId)
		.order('created_at', { ascending: false });
	if (error) throw error;
	return data ?? [];
}

export async function createContainer(data: CreateContainerInput): Promise<Container> {
	const { data: container, error } = await supabase
		.from('inventory_containers')
		.insert({ status: 'available', ...data })
		.select('*')
		.single();
	if (error) throw error;

	await logContainerEvent({
		container_id: container.id,
		event_type: 'created',
		performed_by: '',
		performed_by_name: ''
	});

	return container;
}

export async function updateContainer(id: string, data: Partial<Container>): Promise<Container> {
	const { data: container, error } = await supabase
		.from('inventory_containers')
		.update({ ...data, updated_at: new Date().toISOString() })
		.eq('id', id)
		.select('*')
		.single();
	if (error) throw error;
	return container;
}

async function logContainerEvent(event: {
	container_id: string;
	event_type: string;
	performed_by: string;
	performed_by_name: string;
	location_id?: string | null;
	location_name?: string | null;
	notes?: string;
}) {
	await supabase.from('inventory_container_events').insert(event);
}

export async function addAssetToContainer(
	assetId: string,
	containerId: string,
	performedBy: string,
	performedByName = ''
): Promise<void> {
	const { error } = await supabase
		.from('inventory_assets')
		.update({ container_id: containerId })
		.eq('asset_id', assetId);
	if (error) throw error;

	await logContainerEvent({
		container_id: containerId,
		event_type: 'asset_added',
		performed_by: performedBy,
		performed_by_name: performedByName,
		notes: `Added asset ${assetId}`
	});
}

export async function removeAssetFromContainer(
	assetId: string,
	containerId: string,
	performedBy: string,
	forced = false,
	performedByName = ''
): Promise<void> {
	const { error } = await supabase
		.from('inventory_assets')
		.update({ container_id: null })
		.eq('asset_id', assetId);
	if (error) throw error;

	await logContainerEvent({
		container_id: containerId,
		event_type: 'asset_removed',
		performed_by: performedBy,
		performed_by_name: performedByName,
		notes: forced ? `Force removed asset ${assetId}` : `Removed asset ${assetId}`
	});
}

export async function clearContainer(
	containerId: string,
	performedBy: string,
	performedByName = ''
): Promise<void> {
	const { error } = await supabase
		.from('inventory_assets')
		.update({ container_id: null })
		.eq('container_id', containerId);
	if (error) throw error;

	await logContainerEvent({
		container_id: containerId,
		event_type: 'asset_removed',
		performed_by: performedBy,
		performed_by_name: performedByName,
		notes: 'Cleared all assets from container'
	});
}

export async function commitContainerOperation(
	containerId: string,
	mode: 'check_in' | 'check_out',
	locationId: string | null,
	userId: string,
	userName: string
): Promise<Container> {
	const status = mode === 'check_in' ? 'available' : 'checked_out';
	const currentUserId = mode === 'check_in' ? null : userId;
	const currentUserName = mode === 'check_in' ? null : userName;

	const { data: container, error } = await supabase
		.from('inventory_containers')
		.update({
			status,
			current_user_id: currentUserId,
			current_user_name: currentUserName,
			current_location_id: locationId,
			updated_at: new Date().toISOString()
		})
		.eq('id', containerId)
		.select('*')
		.single();
	if (error) throw error;

	await logContainerEvent({
		container_id: containerId,
		event_type: mode,
		performed_by: userId,
		performed_by_name: userName,
		location_id: locationId
	});

	return container;
}
