import { supabase } from '$lib/supabase';
import type { Asset, Container } from '$lib/types';
import type { ScanAction, ScannedItem } from '$stores/scanPanel';

interface CommitMember {
	id: string;
	name: string;
}

interface CommitResult {
	success: boolean;
	error?: string;
}

/**
 * inventory_events.event_type has a CHECK constraint of its own, distinct
 * from inventory_container_events — 'checkout'/'checkin'/'location' with no
 * underscores, not 'check_out'/'check_in'/'location_update'. Getting this
 * wrong makes every commit fail with a constraint violation.
 */
const ASSET_EVENT_TYPE: Record<ScanAction, string> = {
	check_out: 'checkout',
	check_in: 'checkin',
	update: 'location',
	mark_lost: 'lost'
};

/**
 * inventory_container_events' CHECK constraint has no equivalent to
 * "mark lost" — ContainerStatus doesn't include 'lost'. Containers scanned
 * alongside assets in a "Mark Lost" session are skipped, not errored.
 */
const CONTAINER_EVENT_TYPE: Partial<Record<ScanAction, string>> = {
	check_out: 'check_out',
	check_in: 'check_in',
	update: 'location_update'
};

export async function commitSession(
	items: ScannedItem[],
	action: ScanAction,
	locationId: string | null,
	member: CommitMember
): Promise<CommitResult> {
	const validItems = items.filter((i) => !i.isUnknown);

	for (const item of validItems) {
		if (item.asset) {
			const result = await commitAsset(item.asset, action, locationId, member);
			if (!result.success) return result;
		}

		if (item.container) {
			const result = await commitContainer(item.container, action, locationId, member);
			if (!result.success) return result;
		}
	}

	return { success: true };
}

async function commitAsset(
	asset: Asset,
	action: ScanAction,
	locationId: string | null,
	member: CommitMember
): Promise<CommitResult> {
	const updates: Partial<Asset> = { updated_at: new Date().toISOString() };

	switch (action) {
		case 'check_out':
			updates.status = 'checked_out';
			updates.current_user_id = member.id;
			updates.current_user_name = member.name;
			updates.current_location_id = null;
			break;
		case 'check_in':
			updates.status = 'available';
			updates.current_user_id = null;
			updates.current_user_name = null;
			updates.current_location_id = locationId;
			break;
		case 'update':
			updates.current_location_id = locationId;
			break;
		case 'mark_lost':
			updates.status = 'lost';
			break;
	}

	const { error: updateError } = await supabase
		.from('inventory_assets')
		.update(updates)
		.eq('asset_id', asset.asset_id);
	if (updateError) return { success: false, error: updateError.message };

	const { error: eventError } = await supabase.from('inventory_events').insert({
		asset_id: asset.asset_id,
		event_type: ASSET_EVENT_TYPE[action],
		performed_by: member.id,
		performed_by_name: member.name,
		location_id: locationId,
		created_at: new Date().toISOString()
	});
	if (eventError) return { success: false, error: eventError.message };

	return { success: true };
}

async function commitContainer(
	container: Container,
	action: ScanAction,
	locationId: string | null,
	member: CommitMember
): Promise<CommitResult> {
	const eventType = CONTAINER_EVENT_TYPE[action];
	if (!eventType) {
		// "Mark Lost" has no container equivalent — skip silently. Any assets
		// scanned alongside it in the same session are still processed.
		return { success: true };
	}

	const containerUpdates: Partial<Container> = { updated_at: new Date().toISOString() };
	const assetUpdates: Partial<Asset> = {};

	switch (action) {
		case 'check_out':
			containerUpdates.status = 'checked_out';
			containerUpdates.current_user_id = member.id;
			containerUpdates.current_user_name = member.name;
			containerUpdates.current_location_id = null;
			assetUpdates.status = 'checked_out';
			assetUpdates.current_user_id = member.id;
			assetUpdates.current_user_name = member.name;
			assetUpdates.current_location_id = null;
			break;
		case 'check_in':
			containerUpdates.status = 'available';
			containerUpdates.current_user_id = null;
			containerUpdates.current_user_name = null;
			containerUpdates.current_location_id = locationId;
			assetUpdates.status = 'available';
			assetUpdates.current_user_id = null;
			assetUpdates.current_user_name = null;
			assetUpdates.current_location_id = locationId;
			break;
		case 'update':
			containerUpdates.current_location_id = locationId;
			assetUpdates.current_location_id = locationId;
			break;
	}

	const { error: containerError } = await supabase
		.from('inventory_containers')
		.update(containerUpdates)
		.eq('id', container.id);
	if (containerError) return { success: false, error: containerError.message };

	// Cascade the same custody/location change to every asset currently in
	// this container — this batch scan-panel commit is the one place that
	// does this; the single-container detail page's check-in/out doesn't.
	if (Object.keys(assetUpdates).length > 0) {
		const { error: assetsError } = await supabase
			.from('inventory_assets')
			.update(assetUpdates)
			.eq('container_id', container.id);
		if (assetsError) return { success: false, error: assetsError.message };
	}

	const { error: eventError } = await supabase.from('inventory_container_events').insert({
		container_id: container.id,
		event_type: eventType,
		performed_by: member.id,
		performed_by_name: member.name,
		location_id: locationId,
		created_at: new Date().toISOString()
	});
	if (eventError) return { success: false, error: eventError.message };

	return { success: true };
}
