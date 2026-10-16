import { supabase } from '$lib/supabase';
import type { Asset, Container, Location } from '$lib/types';

/**
 * Asset IDs, location codes and (legacy) container codes all live in one
 * scannable code space: a printed tag can be any of them, so a code must
 * resolve to exactly one thing. Lookup order matches lf-scan's
 * resolveScannedCode — assets first, then locations — with the legacy
 * inventory_containers table checked last (it still holds rows lf-scan's
 * Containers screen reads).
 */
export type CodeOwner =
	| { kind: 'asset'; asset: Asset }
	| { kind: 'location'; location: Location }
	| { kind: 'container'; container: Container };

export async function resolveCode(raw: string): Promise<CodeOwner | null> {
	const code = raw.trim();
	if (!code) return null;

	const { data: asset, error: assetError } = await supabase
		.from('inventory_assets')
		.select('*')
		.eq('asset_id', code)
		.maybeSingle();
	if (assetError) throw assetError;
	if (asset) return { kind: 'asset', asset };

	const { data: location, error: locationError } = await supabase
		.from('inventory_locations')
		.select('*')
		.eq('code', code)
		.maybeSingle();
	if (locationError) throw locationError;
	if (location) return { kind: 'location', location };

	const { data: container, error: containerError } = await supabase
		.from('inventory_containers')
		.select('*')
		.eq('container_id', code)
		.maybeSingle();
	if (containerError) throw containerError;
	if (container) return { kind: 'container', container };

	return null;
}

const KIND_LABEL: Record<CodeOwner['kind'], string> = {
	asset: 'an asset',
	location: 'a location',
	container: 'a container'
};

/**
 * Validates a new/renamed code: non-blank and not already used by anything
 * else. Returns an error message, or null if the code is free. `self` is the
 * record being renamed, so keeping its current code isn't a conflict.
 */
export async function checkCodeAvailable(
	raw: string,
	self?: { kind: 'asset'; assetId: string } | { kind: 'location'; locationId: string }
): Promise<string | null> {
	const code = raw.trim();
	if (!code) return "ID can't be blank";

	const owner = await resolveCode(code);
	if (!owner) return null;
	if (self?.kind === 'asset' && owner.kind === 'asset' && owner.asset.asset_id === self.assetId) {
		return null;
	}
	if (
		self?.kind === 'location' &&
		owner.kind === 'location' &&
		owner.location.id === self.locationId
	) {
		return null;
	}
	return `"${code}" is already in use by ${KIND_LABEL[owner.kind]}`;
}
