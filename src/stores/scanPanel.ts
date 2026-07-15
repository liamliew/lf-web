import { writable, derived } from 'svelte/store';
import type { Asset, Container } from '$lib/types';

export type ScanInputMethod = 'manual' | 'camera';
export type ScanAction = 'check_in' | 'check_out' | 'update' | 'mark_lost';
export type ScanResult = 'good' | 'duplicate' | 'unknown';

export interface ScannedItem {
	id: string; // generated client-side (crypto.randomUUID())
	asset: Asset | null;
	container: Container | null;
	isUnknown: boolean;
	rawCode: string;
	scannedAt: number;
}

interface ScanPanelState {
	isOpen: boolean;
	inputMethod: ScanInputMethod;
	scannedItems: ScannedItem[];
	selectedAction: ScanAction | null;
	selectedLocationId: string | null;
	isCommitting: boolean;
	lastScannedCode: string;
	lastScanResult: ScanResult | null;
}

function createScanPanelStore() {
	const { subscribe, update } = writable<ScanPanelState>({
		isOpen: false,
		inputMethod: 'manual',
		scannedItems: [],
		selectedAction: null,
		selectedLocationId: null,
		isCommitting: false,
		lastScannedCode: '',
		lastScanResult: null
	});

	return {
		subscribe,
		open: () => update((s) => ({ ...s, isOpen: true })),
		close: () => update((s) => ({ ...s, isOpen: false })),
		toggle: () => update((s) => ({ ...s, isOpen: !s.isOpen })),

		setInputMethod: (method: ScanInputMethod) => update((s) => ({ ...s, inputMethod: method })),

		addItem: (item: ScannedItem) =>
			update((s) => {
				const isDupe = s.scannedItems.some((i) => i.rawCode === item.rawCode);
				if (isDupe) {
					return { ...s, lastScanResult: 'duplicate', lastScannedCode: item.rawCode };
				}
				return {
					...s,
					scannedItems: [item, ...s.scannedItems],
					lastScanResult: item.isUnknown ? 'unknown' : 'good',
					lastScannedCode: item.rawCode
				};
			}),

		removeItem: (id: string) =>
			update((s) => ({ ...s, scannedItems: s.scannedItems.filter((i) => i.id !== id) })),

		setAction: (action: ScanAction | null) => update((s) => ({ ...s, selectedAction: action })),

		setLocation: (locationId: string | null) =>
			update((s) => ({ ...s, selectedLocationId: locationId })),

		setCommitting: (val: boolean) => update((s) => ({ ...s, isCommitting: val })),

		clearSession: () =>
			update((s) => ({
				...s,
				scannedItems: [],
				selectedAction: null,
				selectedLocationId: null,
				isCommitting: false,
				lastScannedCode: '',
				lastScanResult: null
			}))
	};
}

export const scanPanel = createScanPanelStore();

export const scannedCount = derived(scanPanel, ($s) => $s.scannedItems.length);
export const validCount = derived(
	scanPanel,
	($s) => $s.scannedItems.filter((i) => !i.isUnknown).length
);
export const unknownCount = derived(
	scanPanel,
	($s) => $s.scannedItems.filter((i) => i.isUnknown).length
);
