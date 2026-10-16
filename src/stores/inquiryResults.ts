import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { resolveCode, type CodeOwner } from '$services/codeService';
import { getLocationForContainerAsset } from '$services/locationService';
import { indexLocations, locationPath } from '$lib/locationHierarchy';
import { soundManager } from '$lib/soundManager';
import type { Asset, Location } from '$lib/types';

/**
 * Floating Inquiry results — every scanned/typed code opens a result window
 * that slides in, stacks on top of earlier ones and auto-dismisses. Mirrors
 * lf-scan's FloatingResultWindow: assets show where they are; locations and
 * containers also show their direct contents (not recursive).
 */

export interface InquiryResult {
	id: string;
	code: string;
	loading: boolean;
	error: string | null;
	owner: CodeOwner | null;
	/** Root-first path of where the thing currently is ("Warehouse › Shelf A"). */
	whereabouts: string | null;
	/** For an asset that is itself a container location. */
	containerLocation: Location | null;
	/** Direct contents — set for locations, container assets and legacy containers. */
	contents: Asset[] | null;
}

export const AUTO_DISMISS_MS = 10_000;
const MAX_STACK = 4;

const { subscribe, update } = writable<InquiryResult[]>([]);
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleDismiss(id: string) {
	clearTimeout(timers.get(id));
	timers.set(
		id,
		setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
	);
}

function dismiss(id: string) {
	clearTimeout(timers.get(id));
	timers.delete(id);
	update((results) => results.filter((r) => r.id !== id));
}

function patch(id: string, changes: Partial<InquiryResult>) {
	update((results) => results.map((r) => (r.id === id ? { ...r, ...changes } : r)));
}

async function loadAllLocations(): Promise<Location[]> {
	const { data } = await supabase.from('inventory_locations').select('*');
	return data ?? [];
}

async function assetsAt(locationId: string): Promise<Asset[]> {
	const { data } = await supabase
		.from('inventory_assets')
		.select('*')
		.eq('current_location_id', locationId)
		.order('name');
	return data ?? [];
}

async function describe(owner: CodeOwner): Promise<Partial<InquiryResult>> {
	const locations = await loadAllLocations();
	const byId = indexLocations(locations);

	if (owner.kind === 'asset') {
		const { asset } = owner;
		const containerLocation = await getLocationForContainerAsset(asset.asset_id);
		return {
			whereabouts: asset.current_location_id
				? locationPath(asset.current_location_id, byId) || null
				: null,
			containerLocation,
			contents: containerLocation ? await assetsAt(containerLocation.id) : null
		};
	}

	if (owner.kind === 'location') {
		const { location } = owner;
		return {
			whereabouts: location.parent_id ? locationPath(location.parent_id, byId) : null,
			contents: await assetsAt(location.id)
		};
	}

	const { container } = owner;
	const { data } = await supabase
		.from('inventory_assets')
		.select('*')
		.eq('container_id', container.id)
		.order('name');
	return {
		whereabouts: container.current_location_id
			? locationPath(container.current_location_id, byId) || null
			: null,
		contents: data ?? []
	};
}

async function lookup(rawCode: string): Promise<void> {
	const code = rawCode.trim();
	if (!code) return;

	// Re-scanning a code that's already on screen refreshes it and brings it
	// to the top instead of stacking a duplicate.
	let existingId: string | undefined;
	update((results) => {
		existingId = results.find((r) => r.code === code)?.id;
		return results;
	});
	if (existingId) dismiss(existingId);

	const id = crypto.randomUUID();
	update((results) => {
		const next: InquiryResult[] = [
			{
				id,
				code,
				loading: true,
				error: null,
				owner: null,
				whereabouts: null,
				containerLocation: null,
				contents: null
			},
			...results
		];
		for (const dropped of next.slice(MAX_STACK)) {
			clearTimeout(timers.get(dropped.id));
			timers.delete(dropped.id);
		}
		return next.slice(0, MAX_STACK);
	});
	scheduleDismiss(id);

	try {
		const owner = await resolveCode(code);
		if (!owner) {
			soundManager.unknownScan();
			patch(id, { loading: false });
			return;
		}
		soundManager.goodScan();
		patch(id, { owner });
		patch(id, { ...(await describe(owner)), loading: false });
	} catch (err) {
		patch(id, { loading: false, error: err instanceof Error ? err.message : 'Lookup failed' });
	}
}

export const inquiryResults = {
	subscribe,
	lookup,
	dismiss,
	/** Hovering a window holds it open; leaving restarts its timer. */
	hold: (id: string) => clearTimeout(timers.get(id)),
	release: (id: string) => scheduleDismiss(id)
};
