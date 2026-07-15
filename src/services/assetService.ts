import { supabase } from '$lib/supabase';
import type { Asset, Container, CreateAssetInput, InventoryEvent, Location } from '$lib/types';

export interface AssetFilters {
	status?: string;
	search?: string;
	locationId?: string;
	containerId?: string;
}

export async function getAssets(filters: AssetFilters = {}): Promise<Asset[]> {
	let query = supabase.from('inventory_assets').select('*').order('name', { ascending: true });

	if (filters.status && filters.status !== 'all') {
		query = query.eq('status', filters.status);
	}
	if (filters.search) {
		query = query.or(`name.ilike.%${filters.search}%,asset_id.ilike.%${filters.search}%`);
	}
	if (filters.locationId) {
		query = query.eq('current_location_id', filters.locationId);
	}
	if (filters.containerId) {
		query = query.eq('container_id', filters.containerId);
	}

	const { data, error } = await query;
	if (error) throw error;
	return data ?? [];
}

export async function getAsset(
	assetId: string
): Promise<
	| (Asset & { location: Location | null; container: Container | null; events: InventoryEvent[] })
	| null
> {
	const { data: asset, error } = await supabase
		.from('inventory_assets')
		.select('*')
		.eq('asset_id', assetId)
		.maybeSingle();
	if (error) throw error;
	if (!asset) return null;

	const [location, container, events] = await Promise.all([
		asset.current_location_id
			? supabase
					.from('inventory_locations')
					.select('*')
					.eq('id', asset.current_location_id)
					.maybeSingle()
			: Promise.resolve({ data: null }),
		asset.container_id
			? supabase.from('inventory_containers').select('*').eq('id', asset.container_id).maybeSingle()
			: Promise.resolve({ data: null }),
		getAssetEvents(assetId)
	]);

	return {
		...asset,
		location: location.data ?? null,
		container: container.data ?? null,
		events
	};
}

export async function createAsset(data: CreateAssetInput): Promise<Asset> {
	const { data: asset, error } = await supabase
		.from('inventory_assets')
		.insert({ status: 'available', ...data })
		.select('*')
		.single();
	if (error) throw error;

	await supabase.from('inventory_events').insert({
		asset_id: asset.asset_id,
		event_type: 'created',
		note: 'Asset created'
	});

	return asset;
}

export async function updateAsset(assetId: string, data: Partial<Asset>): Promise<Asset> {
	const { data: asset, error } = await supabase
		.from('inventory_assets')
		.update({ ...data, updated_at: new Date().toISOString() })
		.eq('asset_id', assetId)
		.select('*')
		.single();
	if (error) throw error;
	return asset;
}

export async function deleteAsset(assetId: string): Promise<void> {
	const { error } = await supabase.from('inventory_assets').delete().eq('asset_id', assetId);
	if (error) throw error;
}

export async function getAssetEvents(assetId: string): Promise<InventoryEvent[]> {
	const { data, error } = await supabase
		.from('inventory_events')
		.select('*')
		.eq('asset_id', assetId)
		.order('created_at', { ascending: false });
	if (error) throw error;
	return data ?? [];
}

/** Picks a random 4-digit asset_id (e.g. "0427") that isn't already in use. */
export async function generateUniqueAssetId(): Promise<string> {
	const { data, error } = await supabase.from('inventory_assets').select('asset_id');
	if (error) throw error;

	const used = new Set((data ?? []).map((row) => row.asset_id));
	if (used.size >= 10000) {
		throw new Error('All 4-digit asset IDs are already in use.');
	}

	let candidate: string;
	do {
		candidate = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
	} while (used.has(candidate));

	return candidate;
}
