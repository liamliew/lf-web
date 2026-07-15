import { get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { scanPanel } from '$stores/scanPanel';
import { soundManager } from '$lib/soundManager';

export async function processScannedCode(code: string): Promise<void> {
	const trimmed = code.trim();
	if (!trimmed) return;

	const isDupe = get(scanPanel).scannedItems.some((i) => i.rawCode === trimmed);
	if (isDupe) {
		soundManager.duplicateScan();
		scanPanel.addItem({
			id: crypto.randomUUID(),
			asset: null,
			container: null,
			isUnknown: false,
			rawCode: trimmed,
			scannedAt: Date.now()
		});
		return;
	}

	const { data: asset } = await supabase
		.from('inventory_assets')
		.select('*')
		.eq('asset_id', trimmed)
		.maybeSingle();

	if (asset) {
		soundManager.goodScan();
		scanPanel.addItem({
			id: crypto.randomUUID(),
			asset,
			container: null,
			isUnknown: false,
			rawCode: trimmed,
			scannedAt: Date.now()
		});
		return;
	}

	const { data: container } = await supabase
		.from('inventory_containers')
		.select('*')
		.eq('container_id', trimmed)
		.maybeSingle();

	if (container) {
		soundManager.goodScan();
		scanPanel.addItem({
			id: crypto.randomUUID(),
			asset: null,
			container,
			isUnknown: false,
			rawCode: trimmed,
			scannedAt: Date.now()
		});
		return;
	}

	// Not found — add as unknown so the panel still shows what was scanned.
	soundManager.unknownScan();
	scanPanel.addItem({
		id: crypto.randomUUID(),
		asset: null,
		container: null,
		isUnknown: true,
		rawCode: trimmed,
		scannedAt: Date.now()
	});
}
