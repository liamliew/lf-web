/**
 * Tiny beep-based audio feedback for scan results — no audio files, just
 * generated tones via the Web Audio API.
 */

let sharedContext: AudioContext | undefined;

function getContext(): AudioContext | undefined {
	if (typeof window === 'undefined') return undefined;
	sharedContext ??= new AudioContext();
	// Browsers start a fresh AudioContext "suspended" until a user gesture;
	// by the time a scan happens the user has already interacted with the
	// page, so this reliably wakes it back up if needed.
	if (sharedContext.state === 'suspended') {
		void sharedContext.resume();
	}
	return sharedContext;
}

function generateBeep(frequency: number, duration: number, volume = 0.3) {
	const ctx = getContext();
	if (!ctx) return;

	const oscillator = ctx.createOscillator();
	const gainNode = ctx.createGain();

	oscillator.connect(gainNode);
	gainNode.connect(ctx.destination);

	oscillator.frequency.value = frequency;
	oscillator.type = 'sine';

	// Fade in and out to prevent clicking
	gainNode.gain.setValueAtTime(0, ctx.currentTime);
	gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.005);
	gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration - 0.005);

	oscillator.start(ctx.currentTime);
	oscillator.stop(ctx.currentTime + duration);
}

export const soundManager = {
	goodScan: () => {
		generateBeep(880, 0.12);
	},

	duplicateScan: () => {
		generateBeep(660, 0.08);
		setTimeout(() => generateBeep(440, 0.08), 140);
	},

	unknownScan: () => {
		for (let i = 0; i < 8; i++) {
			setTimeout(() => {
				generateBeep(i % 2 === 0 ? 880 : 300, 0.06);
			}, i * 100);
		}
	}
};
