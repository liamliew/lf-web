import { supabase } from '$lib/supabase';
import type { Asset, CreateLocationInput, Location } from '$lib/types';

export async function getLocations(): Promise<Location[]> {
	const { data, error } = await supabase
		.from('inventory_locations')
		.select('*')
		.order('name', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function getLocation(id: string): Promise<(Location & { assets: Asset[] }) | null> {
	const { data: location, error } = await supabase
		.from('inventory_locations')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	if (error) throw error;
	if (!location) return null;

	const { data: assets, error: assetsError } = await supabase
		.from('inventory_assets')
		.select('*')
		.eq('current_location_id', id);
	if (assetsError) throw assetsError;

	return { ...location, assets: assets ?? [] };
}

export async function getLocationByCode(code: string): Promise<Location | null> {
	const { data, error } = await supabase
		.from('inventory_locations')
		.select('*')
		.eq('location_code', code)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function createLocation(data: CreateLocationInput): Promise<Location> {
	const { data: location, error } = await supabase
		.from('inventory_locations')
		.insert(data)
		.select('*')
		.single();
	if (error) throw error;
	return location;
}

export async function updateLocation(id: string, data: Partial<Location>): Promise<Location> {
	const { data: location, error } = await supabase
		.from('inventory_locations')
		.update(data)
		.eq('id', id)
		.select('*')
		.single();
	if (error) throw error;
	return location;
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

	const { error } = await supabase.from('inventory_locations').delete().eq('id', id);
	if (error) throw error;
}
