import { supabase } from '$lib/supabase';
import type { Asset, CreateLocationInput, Location } from '$lib/types';
import { checkCodeAvailable } from '$services/codeService';

export async function getLocations(): Promise<Location[]> {
	const { data, error } = await supabase
		.from('inventory_locations')
		.select('*')
		.order('name', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

/**
 * A location plus its direct contents. "Contents" means assets whose
 * current_location_id is this location — not recursive into sub-locations,
 * same scope lf-scan uses.
 */
export async function getLocation(
	id: string
): Promise<(Location & { assets: Asset[]; linkedAsset: Asset | null }) | null> {
	const { data: location, error } = await supabase
		.from('inventory_locations')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	if (error) throw error;
	if (!location) return null;

	const [{ data: assets, error: assetsError }, { data: linkedAsset }] = await Promise.all([
		supabase.from('inventory_assets').select('*').eq('current_location_id', id).order('name'),
		location.linked_asset_id
			? supabase
					.from('inventory_assets')
					.select('*')
					.eq('asset_id', location.linked_asset_id)
					.maybeSingle()
			: Promise.resolve({ data: null })
	]);
	if (assetsError) throw assetsError;

	return { ...location, assets: assets ?? [], linkedAsset: linkedAsset ?? null };
}

export async function getLocationByCode(code: string): Promise<Location | null> {
	const { data, error } = await supabase
		.from('inventory_locations')
		.select('*')
		.eq('code', code)
		.maybeSingle();
	if (error) throw error;
	return data;
}

/** Reverse lookup: the container location an asset represents, if any. */
export async function getLocationForContainerAsset(assetId: string): Promise<Location | null> {
	const { data, error } = await supabase
		.from('inventory_locations')
		.select('*')
		.eq('linked_asset_id', assetId)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function getAssetsInLocation(locationId: string): Promise<Asset[]> {
	const { data, error } = await supabase
		.from('inventory_assets')
		.select('*')
		.eq('current_location_id', locationId)
		.order('name');
	if (error) throw error;
	return data ?? [];
}

/**
 * Omitting `code` lets the DB default assign a "LOC-XXXXXXXX" code.
 * description is NOT NULL DEFAULT '' — send '' rather than null.
 */
export async function createLocation(data: CreateLocationInput): Promise<Location> {
	if (data.code) {
		const codeError = await checkCodeAvailable(data.code);
		if (codeError) throw new Error(codeError);
	}
	const { data: location, error } = await supabase
		.from('inventory_locations')
		.insert({
			name: data.name,
			description: data.description ?? '',
			parent_id: data.parent_id ?? null,
			...(data.code ? { code: data.code.trim() } : {})
		})
		.select('*')
		.single();
	if (error) throw error;
	return location;
}

export async function updateLocation(id: string, data: Partial<Location>): Promise<Location> {
	if (data.code !== undefined) {
		const codeError = await checkCodeAvailable(data.code, { kind: 'location', locationId: id });
		if (codeError) throw new Error(codeError);
		data = { ...data, code: data.code.trim() };
	}
	const { data: location, error } = await supabase
		.from('inventory_locations')
		.update(data)
		.eq('id', id)
		.select('*')
		.single();
	if (error) throw error;
	return location;
}

export interface NewContainerAsset {
	assetId: string;
	name: string;
	category: string;
}

interface Performer {
	id: string;
	name: string;
}

/**
 * Every container location MUST have a linked asset. Mirrors lf-scan's
 * createContainerLocationWithNewAsset / convertLocationToContainerWithNewAsset:
 * two sequential writes, asset first; if the location write fails the
 * just-created asset is deleted again rather than left orphaned. (This
 * codebase doesn't use DB transactions anywhere, so this matches that.)
 */
async function insertContainerAsset(asset: NewContainerAsset, performer: Performer) {
	const codeError = await checkCodeAvailable(asset.assetId);
	if (codeError) throw new Error(codeError);

	const { error } = await supabase.from('inventory_assets').insert({
		asset_id: asset.assetId.trim(),
		name: asset.name.trim(),
		category: asset.category,
		status: 'available'
	});
	if (error) throw error;

	await supabase.from('inventory_events').insert({
		asset_id: asset.assetId.trim(),
		event_type: 'created',
		performed_by: performer.id,
		performed_by_name: performer.name,
		note: 'Container asset created'
	});
}

async function rollbackContainerAsset(assetId: string) {
	await supabase.from('inventory_assets').delete().eq('asset_id', assetId.trim());
}

export async function createContainerLocation(
	location: CreateLocationInput,
	asset: NewContainerAsset,
	performer: Performer
): Promise<Location> {
	if (location.code) {
		const codeError = await checkCodeAvailable(location.code);
		if (codeError) throw new Error(codeError);
	}
	if (location.code?.trim() === asset.assetId.trim()) {
		throw new Error('The location code and the container asset ID must be different');
	}
	await insertContainerAsset(asset, performer);
	try {
		const { data, error } = await supabase
			.from('inventory_locations')
			.insert({
				name: location.name,
				description: location.description ?? '',
				parent_id: location.parent_id ?? null,
				linked_asset_id: asset.assetId.trim(),
				...(location.code ? { code: location.code.trim() } : {})
			})
			.select('*')
			.single();
		if (error) throw error;
		return data;
	} catch (err) {
		await rollbackContainerAsset(asset.assetId);
		throw err;
	}
}

export async function convertLocationToContainer(
	locationId: string,
	updates: Partial<Location>,
	asset: NewContainerAsset,
	performer: Performer
): Promise<Location> {
	if (updates.code?.trim() === asset.assetId.trim()) {
		throw new Error('The location code and the container asset ID must be different');
	}
	await insertContainerAsset(asset, performer);
	try {
		return await updateLocation(locationId, { ...updates, linked_asset_id: asset.assetId.trim() });
	} catch (err) {
		await rollbackContainerAsset(asset.assetId);
		throw err;
	}
}

export async function deleteLocation(id: string): Promise<void> {
	const { count, error: countError } = await supabase
		.from('inventory_assets')
		.select('*', { count: 'exact', head: true })
		.eq('current_location_id', id);
	if (countError) throw countError;
	if (count && count > 0) {
		throw new Error('Cannot delete a location that still has assets assigned to it.');
	}

	const { count: childCount, error: childError } = await supabase
		.from('inventory_locations')
		.select('*', { count: 'exact', head: true })
		.eq('parent_id', id);
	if (childError) throw childError;
	if (childCount && childCount > 0) {
		throw new Error('Move or delete its sub-locations first.');
	}

	const { error } = await supabase.from('inventory_locations').delete().eq('id', id);
	if (error) throw error;
}
