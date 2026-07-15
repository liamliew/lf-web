import { supabase } from '$lib/supabase';
import type { AssetEventType, ContainerEventType } from '$lib/types';

/**
 * Asset activity (inventory_events) and container activity
 * (inventory_container_events) live in separate tables. This unifies both
 * into one feed for the /activity page.
 */
export interface ActivityFeedItem {
	id: string;
	source: 'asset' | 'container';
	event_type: AssetEventType | ContainerEventType;
	asset_id: string | null;
	container_id: string | null;
	performed_by: string | null;
	performed_by_name: string | null;
	location_id: string | null;
	location_name: string | null;
	gps_lat: number | null;
	gps_lng: number | null;
	gps_address: string | null;
	note: string | null;
	created_at: string;
}

export interface ActivityFilters {
	eventType?: string;
	performedBy?: string;
	assetId?: string;
	from?: string;
	to?: string;
	page?: number;
	pageSize?: number;
}

const FETCH_CAP = 1000;

export async function getGlobalActivity(
	filters: ActivityFilters = {}
): Promise<{ events: ActivityFeedItem[]; count: number }> {
	const pageSize = filters.pageSize ?? 50;
	const page = filters.page ?? 1;

	let assetQuery = supabase
		.from('inventory_events')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(FETCH_CAP);
	let containerQuery = supabase
		.from('inventory_container_events')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(FETCH_CAP);

	if (filters.performedBy) {
		assetQuery = assetQuery.eq('performed_by', filters.performedBy);
		containerQuery = containerQuery.eq('performed_by', filters.performedBy);
	}
	if (filters.assetId) {
		assetQuery = assetQuery.eq('asset_id', filters.assetId);
	}
	if (filters.from) {
		assetQuery = assetQuery.gte('created_at', filters.from);
		containerQuery = containerQuery.gte('created_at', filters.from);
	}
	if (filters.to) {
		assetQuery = assetQuery.lte('created_at', filters.to);
		containerQuery = containerQuery.lte('created_at', filters.to);
	}
	if (filters.eventType && filters.eventType !== 'all') {
		assetQuery = assetQuery.eq('event_type', filters.eventType);
		containerQuery = containerQuery.eq('event_type', filters.eventType);
	}

	// Container events have no asset_id column, so an asset-scoped query
	// can never match one — skip that fetch entirely in that case.
	const [assetResult, containerResult] = await Promise.all([
		assetQuery,
		filters.assetId ? Promise.resolve({ data: [], error: null }) : containerQuery
	]);

	if (assetResult.error) throw assetResult.error;
	if (containerResult.error) throw containerResult.error;

	const assetEvents: ActivityFeedItem[] = (assetResult.data ?? []).map((e) => ({
		id: e.id,
		source: 'asset' as const,
		event_type: e.event_type,
		asset_id: e.asset_id,
		container_id: null,
		performed_by: e.performed_by,
		performed_by_name: e.performed_by_name,
		location_id: e.location_id,
		location_name: null,
		gps_lat: e.gps_lat,
		gps_lng: e.gps_lng,
		gps_address: e.gps_address,
		note: e.note,
		created_at: e.created_at
	}));

	const containerEvents: ActivityFeedItem[] = (containerResult.data ?? []).map((e) => ({
		id: e.id,
		source: 'container' as const,
		event_type: e.event_type,
		asset_id: null,
		container_id: e.container_id,
		performed_by: e.performed_by,
		performed_by_name: e.performed_by_name,
		location_id: e.location_id,
		location_name: e.location_name,
		gps_lat: e.gps_lat,
		gps_lng: e.gps_lng,
		gps_address: e.gps_address,
		note: e.notes,
		created_at: e.created_at
	}));

	const merged = [...assetEvents, ...containerEvents].sort(
		(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);

	const from = (page - 1) * pageSize;
	const to = from + pageSize;

	return { events: merged.slice(from, to), count: merged.length };
}
