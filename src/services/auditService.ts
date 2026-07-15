import { supabase } from '$lib/supabase';
import type { Audit, AuditItem, Asset } from '$lib/types';

export async function getAudits(): Promise<Audit[]> {
	const { data, error } = await supabase
		.from('inventory_audits')
		.select('*')
		.order('started_at', { ascending: false });
	if (error) throw error;
	return data ?? [];
}

export async function getAudit(id: string): Promise<(Audit & { items: AuditItem[] }) | null> {
	const { data: audit, error } = await supabase
		.from('inventory_audits')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	if (error) throw error;
	if (!audit) return null;

	const { data: items, error: itemsError } = await supabase
		.from('inventory_audit_items')
		.select('*')
		.eq('audit_id', id);
	if (itemsError) throw itemsError;

	return { ...audit, items: items ?? [] };
}

/**
 * Starts a new audit for a location: creates the audit row, then seeds one
 * expected+pending audit item per asset currently assigned to that
 * location (keyed by asset_code = asset_id). Scanning flips items to
 * matched; anything still pending at completion becomes missing;
 * unrecognized scans become unexpected.
 */
export async function createAudit(
	locationId: string,
	userId: string,
	userName: string
): Promise<Audit> {
	const { data: location, error: locationError } = await supabase
		.from('inventory_locations')
		.select('name')
		.eq('id', locationId)
		.maybeSingle();
	if (locationError) throw locationError;

	const { data: expectedAssets, error: assetsError } = await supabase
		.from('inventory_assets')
		.select('*')
		.eq('current_location_id', locationId);
	if (assetsError) throw assetsError;

	const { data: audit, error } = await supabase
		.from('inventory_audits')
		.insert({
			location_id: locationId,
			location_name: location?.name ?? 'Unknown location',
			status: 'in_progress',
			performed_by: userId,
			performed_by_name: userName,
			started_at: new Date().toISOString(),
			total_expected: expectedAssets?.length ?? 0,
			total_scanned: 0,
			total_matched: 0,
			total_missing: 0,
			total_unexpected: 0
		})
		.select('*')
		.single();
	if (error) throw error;

	if (expectedAssets && expectedAssets.length > 0) {
		const rows = (expectedAssets as Asset[]).map((asset) => ({
			audit_id: audit.id,
			asset_id: asset.asset_id,
			asset_code: asset.asset_id,
			asset_name: asset.name,
			expected: true,
			scanned: false,
			result: 'pending' as const
		}));
		const { error: seedError } = await supabase.from('inventory_audit_items').insert(rows);
		if (seedError) throw seedError;
	}

	return audit;
}

async function recomputeAuditTotals(auditId: string): Promise<void> {
	const { data: items, error } = await supabase
		.from('inventory_audit_items')
		.select('result')
		.eq('audit_id', auditId);
	if (error) throw error;

	const matched = items?.filter((i) => i.result === 'matched').length ?? 0;
	const missing = items?.filter((i) => i.result === 'missing').length ?? 0;
	const unexpected = items?.filter((i) => i.result === 'unexpected').length ?? 0;
	const scanned = matched + unexpected;

	await supabase
		.from('inventory_audits')
		.update({
			total_scanned: scanned,
			total_matched: matched,
			total_missing: missing,
			total_unexpected: unexpected
		})
		.eq('id', auditId);
}

/**
 * Records a scan during an in-progress audit. `code` is the scanned
 * asset_id. If it matches a pending expected item, it's marked matched.
 * Otherwise a new unexpected item is created for the scanned code.
 * inventory_audit_items has no scanned_by column, so the scanning
 * employee isn't persisted per-item — only on the parent audit.
 */
export async function scanBarcode(auditId: string, code: string): Promise<AuditItem> {
	const { data: existing, error: findError } = await supabase
		.from('inventory_audit_items')
		.select('*')
		.eq('audit_id', auditId)
		.eq('asset_code', code)
		.maybeSingle();
	if (findError) throw findError;

	const now = new Date().toISOString();

	let result: AuditItem;
	if (existing) {
		const { data: updated, error } = await supabase
			.from('inventory_audit_items')
			.update({ scanned: true, result: 'matched', scanned_at: now })
			.eq('id', existing.id)
			.select('*')
			.single();
		if (error) throw error;
		result = updated;
	} else {
		const { data: asset } = await supabase
			.from('inventory_assets')
			.select('asset_id, name')
			.eq('asset_id', code)
			.maybeSingle();

		const { data: created, error } = await supabase
			.from('inventory_audit_items')
			.insert({
				audit_id: auditId,
				asset_id: asset?.asset_id ?? null,
				asset_code: code,
				asset_name: asset?.name ?? null,
				expected: false,
				scanned: true,
				result: 'unexpected',
				scanned_at: now
			})
			.select('*')
			.single();
		if (error) throw error;
		result = created;
	}

	await recomputeAuditTotals(auditId);
	return result;
}

export async function completeAudit(auditId: string): Promise<Audit> {
	await supabase
		.from('inventory_audit_items')
		.update({ result: 'missing' })
		.eq('audit_id', auditId)
		.eq('result', 'pending');

	await recomputeAuditTotals(auditId);

	const { data: audit, error } = await supabase
		.from('inventory_audits')
		.update({
			status: 'completed',
			completed_at: new Date().toISOString()
		})
		.eq('id', auditId)
		.select('*')
		.single();
	if (error) throw error;
	return audit;
}

export async function getAuditResults(auditId: string): Promise<{
	matched: AuditItem[];
	missing: AuditItem[];
	unexpected: AuditItem[];
}> {
	const { data, error } = await supabase
		.from('inventory_audit_items')
		.select('*')
		.eq('audit_id', auditId);
	if (error) throw error;

	const items = data ?? [];
	return {
		matched: items.filter((i) => i.result === 'matched'),
		missing: items.filter((i) => i.result === 'missing'),
		unexpected: items.filter((i) => i.result === 'unexpected')
	};
}
