<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import * as Select from '$components/ui/select';
	import * as Tabs from '$components/ui/tabs';
	import ConfirmDialog from '$components/shared/ConfirmDialog.svelte';
	import ScannedItemRow from './ScannedItemRow.svelte';
	import ScanIcon from 'lucide-svelte/icons/scan';
	import BarcodeIcon from 'lucide-svelte/icons/barcode';
	import XIcon from 'lucide-svelte/icons/x';
	import VideoOffIcon from 'lucide-svelte/icons/video-off';
	import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
	import {
		scanPanel,
		scannedCount,
		validCount,
		unknownCount,
		type ScanAction,
		type ScanInputMethod
	} from '$stores/scanPanel';
	import { processScannedCode } from '$lib/scanProcessor';
	import { commitSession } from '$lib/commitSession';
	import { getLocations } from '$services/locationService';
	import { notify } from '$stores/toast';
	import { cn } from '$lib/utils';
	import type { Location } from '$lib/types';

	let { member }: { member: { id: string; name: string } | null } = $props();

	const ACTIONS: { value: ScanAction; label: string; selectedClass: string }[] = [
		{
			value: 'check_out',
			label: 'Check Out',
			selectedClass: 'border-primary bg-primary text-primary-foreground'
		},
		{
			value: 'check_in',
			label: 'Check In',
			selectedClass: 'border-lfc-available bg-lfc-available text-white'
		},
		{
			value: 'update',
			label: 'Update',
			selectedClass: 'border-purple-500 bg-purple-500 text-white'
		},
		{
			value: 'mark_lost',
			label: 'Mark Lost',
			selectedClass: 'border-lfc-lost bg-lfc-lost text-white'
		}
	];

	const ACTION_VERB: Record<ScanAction, string> = {
		check_out: 'checked out',
		check_in: 'checked in',
		update: 'updated',
		mark_lost: 'marked lost'
	};

	let locations = $state<Location[]>([]);
	let locationsLoaded = false;
	const locationsById = $derived(Object.fromEntries(locations.map((l) => [l.id, l])));
	const selectedLocationLabel = $derived(
		locations.find((l) => l.id === $scanPanel.selectedLocationId)?.name ?? 'Select location...'
	);

	let manualInputEl = $state<HTMLInputElement | null>(null);
	let manualCode = $state('');

	let clearConfirmOpen = $state(false);

	let videoEl = $state<HTMLVideoElement | undefined>();
	const cameraSupported = $derived(typeof window !== 'undefined' && 'BarcodeDetector' in window);
	let cameraError = $state('');
	let mediaStream: MediaStream | undefined;
	let cameraInterval: ReturnType<typeof setInterval> | undefined;
	let lastDetectionAt = 0;

	const needsLocation = $derived(
		$scanPanel.selectedAction === 'check_in' || $scanPanel.selectedAction === 'update'
	);
	const canCommit = $derived(
		member !== null &&
			$scanPanel.scannedItems.length > 0 &&
			$scanPanel.selectedAction !== null &&
			!(needsLocation && !$scanPanel.selectedLocationId) &&
			!$scanPanel.isCommitting
	);

	async function ensureLocationsLoaded() {
		if (locationsLoaded) return;
		try {
			locations = await getLocations();
			locationsLoaded = true;
		} catch {
			// non-fatal — location picker just stays empty until reopened
		}
	}

	// Open/close side effects: load locations once, focus the capture input,
	// and make sure the camera never keeps running in the background.
	$effect(() => {
		if ($scanPanel.isOpen) {
			ensureLocationsLoaded();
			queueMicrotask(() => manualInputEl?.focus());
		} else {
			stopCamera();
		}
	});

	// Camera lifecycle tracks the input method tab independently of the
	// open/close effect above so switching tabs starts/stops it immediately.
	$effect(() => {
		if ($scanPanel.isOpen && $scanPanel.inputMethod === 'camera' && cameraSupported) {
			startCamera();
		} else {
			stopCamera();
		}
	});

	onDestroy(() => stopCamera());

	async function handleManualKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		const code = manualCode;
		manualCode = '';
		await processScannedCode(code);
	}

	async function startCamera() {
		cameraError = '';
		try {
			mediaStream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' }
			});
			if (videoEl) {
				videoEl.srcObject = mediaStream;
				await videoEl.play();
			}
			runDetectionLoop();
		} catch {
			cameraError = 'Camera access denied or unavailable.';
		}
	}

	function stopCamera() {
		if (cameraInterval) {
			clearInterval(cameraInterval);
			cameraInterval = undefined;
		}
		mediaStream?.getTracks().forEach((track) => track.stop());
		mediaStream = undefined;
	}

	function runDetectionLoop() {
		if (!cameraSupported || !videoEl) return;
		const detector = new BarcodeDetector({
			formats: [
				'qr_code',
				'code_128',
				'code_39',
				'ean_13',
				'ean_8',
				'data_matrix',
				'pdf417',
				'aztec'
			]
		});

		cameraInterval = setInterval(async () => {
			if (!videoEl) return;
			const now = Date.now();
			if (now - lastDetectionAt < 500) return;
			try {
				const results = await detector.detect(videoEl);
				const value = results[0]?.rawValue;
				if (value) {
					lastDetectionAt = now;
					await processScannedCode(value);
				}
			} catch {
				// keep scanning on transient detection errors
			}
		}, 300);
	}

	async function handleCommit() {
		if (!member || !$scanPanel.selectedAction) return;
		scanPanel.setCommitting(true);
		try {
			const result = await commitSession(
				$scanPanel.scannedItems,
				$scanPanel.selectedAction,
				$scanPanel.selectedLocationId,
				member
			);
			if (result.success) {
				const verb = ACTION_VERB[$scanPanel.selectedAction];
				let message = `${$validCount} items ${verb} successfully`;
				if ($unknownCount > 0) {
					message += ` (${$unknownCount} unknown items skipped)`;
				}
				notify.success(message);
				scanPanel.clearSession();
			} else {
				notify.error('Commit failed', result.error);
			}
		} catch (err) {
			notify.error('Commit failed', err instanceof Error ? err.message : undefined);
		} finally {
			scanPanel.setCommitting(false);
		}
	}
</script>

<button
	type="button"
	onclick={() => scanPanel.toggle()}
	class={cn(
		'fixed bottom-[84px] right-6 z-50 flex size-[52px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-[right] hover:brightness-110',
		$scanPanel.isOpen && 'md:right-[444px]'
	)}
	aria-label="Toggle scan session (Ctrl+Shift+S)"
	title="Scan session (Ctrl+Shift+S)"
>
	<ScanIcon class="size-6" />
	{#if $scannedCount > 0}
		<span
			class="absolute -right-1 -top-1 flex size-5 animate-pulse items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white"
		>
			{$scannedCount}
		</span>
	{/if}
</button>

{#if $scanPanel.isOpen}
	<button
		type="button"
		aria-label="Close scan panel"
		onclick={() => scanPanel.close()}
		class="fixed inset-0 z-40 bg-black/60 md:hidden"
	></button>
{/if}

<div
	class={cn(
		'fixed right-0 top-0 z-[49] flex h-screen w-screen flex-col border-l border-border bg-surface shadow-[-8px_0_32px_rgba(0,0,0,0.4)] transition-transform duration-[250ms] ease-out md:w-[420px]',
		$scanPanel.isOpen ? 'translate-x-0' : 'translate-x-full'
	)}
>
	<div class="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
		<div class="flex items-center gap-2">
			<BarcodeIcon class="size-4 text-muted-foreground" />
			<span class="text-sm font-medium">Scan Session</span>
		</div>
		<div class="flex items-center gap-3">
			{#if $scanPanel.scannedItems.length > 0}
				<button
					type="button"
					onclick={() => (clearConfirmOpen = true)}
					class="text-xs text-muted-foreground hover:text-foreground"
				>
					Clear
				</button>
			{/if}
			<button
				type="button"
				onclick={() => scanPanel.close()}
				class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
				aria-label="Close scan panel"
			>
				<XIcon class="size-4" />
			</button>
		</div>
	</div>

	<div class="shrink-0 space-y-3 px-4 pb-3 pt-3">
		<Tabs.Root
			value={$scanPanel.inputMethod}
			onValueChange={(v) => scanPanel.setInputMethod(v as ScanInputMethod)}
		>
			<Tabs.List class="w-full">
				<Tabs.Trigger value="manual" class="flex-1">Manual / Scanner</Tabs.Trigger>
				<Tabs.Trigger value="camera" class="flex-1">Camera</Tabs.Trigger>
			</Tabs.List>
		</Tabs.Root>

		{#if $scanPanel.inputMethod === 'camera'}
			{#if cameraSupported}
				<div
					class="relative h-[200px] w-full overflow-hidden rounded-lg border border-border bg-black"
				>
					<!-- eslint-disable-next-line svelte/require-each-key -->
					<video bind:this={videoEl} class="h-full w-full object-cover" muted playsinline></video>
				</div>
				{#if cameraError}
					<p class="flex items-center gap-1.5 text-xs text-destructive">
						<VideoOffIcon class="size-3.5" />
						{cameraError}
					</p>
				{/if}
			{:else}
				<p
					class="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground"
				>
					Camera scanning not supported in this browser. Use Chrome or Edge.
				</p>
			{/if}
		{/if}

		<Input
			bind:ref={manualInputEl}
			bind:value={manualCode}
			onkeydown={handleManualKeydown}
			placeholder="Scan or type asset code..."
			autocomplete="off"
			class="h-12 font-mono-lfc text-base"
		/>
	</div>

	<div class="flex-1 overflow-y-auto px-4 pb-2">
		<div class="mb-2 flex items-center justify-between">
			<p class="text-sm font-medium">Scanned ({$scannedCount})</p>
			<p class="text-xs">
				<span class="text-lfc-available">✓ {$validCount}</span>
				<span class="ml-2 text-lfc-lost">✗ {$unknownCount}</span>
			</p>
		</div>

		{#if $scanPanel.scannedItems.length === 0}
			<p class="py-8 text-center text-sm text-muted-foreground">No items scanned yet.</p>
		{:else}
			<ul class="space-y-1">
				{#each $scanPanel.scannedItems as item, index (item.id)}
					<li>
						<ScannedItemRow
							{item}
							expanded={index === 0}
							{locationsById}
							onRemove={() => scanPanel.removeItem(item.id)}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="shrink-0 space-y-3 border-t border-border px-4 py-3">
		<div>
			<Label class="text-xs uppercase tracking-wide text-muted-foreground">Action</Label>
			<div class="mt-1.5 grid grid-cols-2 gap-2">
				{#each ACTIONS as a (a.value)}
					<button
						type="button"
						onclick={() => scanPanel.setAction(a.value)}
						class={cn(
							'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
							$scanPanel.selectedAction === a.value
								? a.selectedClass
								: 'border-border text-muted-foreground hover:text-foreground'
						)}
					>
						{a.label}
					</button>
				{/each}
			</div>
		</div>

		{#if needsLocation}
			<div class="space-y-1.5">
				<Label>Location</Label>
				<Select.Root
					type="single"
					value={$scanPanel.selectedLocationId ?? undefined}
					onValueChange={(v) => scanPanel.setLocation(v ?? null)}
				>
					<Select.Trigger class="w-full">{selectedLocationLabel}</Select.Trigger>
					<Select.Content>
						{#each locations as location (location.id)}
							<Select.Item value={location.id} label={location.name} />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		{/if}
	</div>

	<div class="shrink-0 border-t border-border px-4 py-3">
		<Button class="h-12 w-full" disabled={!canCommit} onclick={handleCommit}>
			{#if $scanPanel.isCommitting}
				<LoaderCircleIcon class="size-4 animate-spin" />
			{/if}
			Commit {$validCount} items
		</Button>
	</div>
</div>

<ConfirmDialog
	bind:open={clearConfirmOpen}
	title="Clear scan session?"
	description={`This removes all ${$scannedCount} scanned items.`}
	confirmLabel="Clear"
	destructive
	onConfirm={() => scanPanel.clearSession()}
/>
