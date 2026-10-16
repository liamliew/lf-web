/**
 * Global capture for keyboard-wedge barcode/RFID scanners (USB/Bluetooth
 * scanners that "type" the code followed by Enter). A burst of printable keys
 * arriving faster than any human types, terminated by Enter/Tab, is treated as
 * a scan. The web counterpart of lf-scan's always-on hardware-scan capture.
 *
 * Keys aimed at an editable element are left alone — inputs that already
 * handle scans themselves (scan panel, audit, inquiry box, forms) keep
 * working exactly as before.
 */

/** Max gap between keystrokes inside one scan burst. Humans are ~100ms+. */
const MAX_KEY_GAP_MS = 50;
const MIN_CODE_LENGTH = 3;

function isEditable(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tag = target.tagName;
	return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function attachHardwareScanner(onScan: (code: string) => void): () => void {
	let buffer = '';
	let lastKeyAt = 0;

	function handleKeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (isEditable(event.target)) {
			buffer = '';
			return;
		}

		const now = performance.now();
		const withinBurst = now - lastKeyAt <= MAX_KEY_GAP_MS;

		if (event.key === 'Enter' || event.key === 'Tab') {
			if (withinBurst && buffer.length >= MIN_CODE_LENGTH) {
				event.preventDefault();
				const code = buffer;
				buffer = '';
				onScan(code);
			} else {
				buffer = '';
			}
			return;
		}

		if (event.key.length !== 1) return; // Shift, arrows, etc.

		buffer = withinBurst ? buffer + event.key : event.key;
		lastKeyAt = now;
	}

	window.addEventListener('keydown', handleKeydown, true);
	return () => window.removeEventListener('keydown', handleKeydown, true);
}
