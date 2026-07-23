<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import ConfirmDialog from '$components/shared/ConfirmDialog.svelte';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import ArrowLeftIcon from 'lucide-svelte/icons/arrow-left';
	import CameraIcon from 'lucide-svelte/icons/camera';
	import CheckIcon from 'lucide-svelte/icons/check';
	import { getAudit, scanBarcode, completeAudit } from '$services/auditService';
	import { notify } from '$stores/toast';
	import { currentUser } from '$stores/auth';
	import type { Audit, AuditItem } from '$lib/types';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	const auditId = $derived(params.id);

	let loading = $state(true);
	let audit = $state<(Audit & { items: AuditItem[] }) | null>(null);
	let barcode = $state('');
	let scanning = $state(false);
	let completeOpen = $state(false);

	let scannerOpen = $state(false);
	const scannerSupported = $derived(typeof window !== 'undefined' && 'BarcodeDetector' in window);
	let videoEl = $state<HTMLVideoElement | undefined>();
	let mediaStream: MediaStream | undefined;
	let scanRaf = 0;

	async function load() {
		loading = true;
		try {
			const result = await getAudit(auditId);
			if (!result) {
				notify.error('Audit not found');
				await goto(resolve('/audit'));
				return;
			}
			audit = result;
		} catch (err) {
			notify.error('Failed to load audit', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const pending = $derived(audit?.items.filter((i) => i.result === 'pending') ?? []);
	const scanned = $derived(
		audit?.items.filter((i) => i.result === 'matched' || i.result === 'unexpected') ?? []
	);
	const total = $derived(audit?.total_expected ?? 0);
	const scannedCount = $derived(scanned.length);

	async function submitBarcode(event: SubmitEvent) {
		event.preventDefault();
		if (!barcode.trim() || !audit || !$currentUser) return;

		scanning = true;
		try {
			const item = await scanBarcode(audit.id, barcode.trim());
			audit.items = [...audit.items.filter((i) => i.id !== item.id), item];
			notify.success(item.result === 'matched' ? 'Matched' : 'Unexpected item scanned');
			barcode = '';
		} catch (err) {
			notify.error('Scan failed', err instanceof Error ? err.message : undefined);
		} finally {
			scanning = false;
		}
	}

	async function handleComplete() {
		if (!audit) return;
		const updated = await completeAudit(audit.id);
		notify.success('Audit completed');
		await goto(resolve('/(app)/audit/[id]/results', { id: updated.id }));
	}

	async function openScanner() {
		scannerOpen = true;
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
			notify.error('Camera access denied or unavailable');
			scannerOpen = false;
		}
	}

	function closeScanner() {
		scannerOpen = false;
		cancelAnimationFrame(scanRaf);
		mediaStream?.getTracks().forEach((track) => track.stop());
		mediaStream = undefined;
	}

	function runDetectionLoop() {
		if (!scannerSupported || !videoEl) return;
		const detector = new BarcodeDetector({ formats: ['code_128', 'qr_code', 'ean_13'] });

		const tick = async () => {
			if (!scannerOpen || !videoEl) return;
			try {
				const results = await detector.detect(videoEl);
				if (results[0]?.rawValue) {
					barcode = results[0].rawValue;
					closeScanner();
					return;
				}
			} catch {
				// keep scanning
			}
			scanRaf = requestAnimationFrame(tick);
		};

		scanRaf = requestAnimationFrame(tick);
	}
</script>

<svelte:head>
	<title>Audit Scanner — Asset Manager</title>
</svelte:head>

<div class="space-y-4">
	<button
		type="button"
		onclick={() => goto(resolve('/audit'))}
		class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-3.5" />
		Back to Audit
	</button>

	{#if loading}
		<LoadingSkeleton rows={6} cols={3} />
	{:else if audit}
		<div class="rounded-lg border border-border p-4">
			<div class="flex items-center justify-between">
				<h1 class="text-lg font-semibold tracking-tight">Audit in Progress</h1>
				<Button onclick={() => (completeOpen = true)}>
					<CheckIcon class="size-4" />
					Complete Audit
				</Button>
			</div>
			<div class="mt-3 h-1.5 w-full rounded-full bg-muted">
				<div
					class="h-1.5 rounded-full bg-primary"
					style={`width: ${total > 0 ? Math.round((scannedCount / total) * 100) : 0}%`}
				></div>
			</div>
			<p class="mt-2 text-sm text-muted-foreground">
				{scannedCount} of {total} expected assets scanned · {pending.length} pending
			</p>
		</div>

		<Card>
			<CardHeader>
				<CardTitle class="text-base">Scan Barcode</CardTitle>
			</CardHeader>
			<CardContent>
				<form onsubmit={submitBarcode} class="flex items-end gap-2">
					<div class="flex-1 space-y-1.5">
						<Label for="barcode">Barcode</Label>
						<Input
							id="barcode"
							bind:value={barcode}
							placeholder="Scan or type barcode…"
							autofocus
						/>
					</div>
					{#if scannerSupported}
						<Button type="button" variant="outline" onclick={openScanner}>
							<CameraIcon class="size-4" />
						</Button>
					{/if}
					<Button type="submit" disabled={scanning || !barcode.trim()}>Submit</Button>
				</form>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle class="text-base">Scanned Items ({scanned.length})</CardTitle>
			</CardHeader>
			<CardContent>
				{#if scanned.length === 0}
					<p class="text-sm text-muted-foreground">No items scanned yet.</p>
				{:else}
					<ul class="divide-y divide-border">
						{#each scanned as item (item.id)}
							<li class="flex items-center justify-between py-2 text-sm">
								<span class="font-mono-lfc text-xs text-muted-foreground">{item.asset_code}</span>
								<span
									class={item.result === 'matched' ? 'text-lfc-available' : 'text-lfc-checked-out'}
								>
									{item.result}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</CardContent>
		</Card>
	{/if}
</div>

<ConfirmDialog
	bind:open={completeOpen}
	title="Complete this audit?"
	description="Any expected assets not yet scanned will be marked as missing."
	confirmLabel="Complete Audit"
	onConfirm={handleComplete}
/>

{#if scannerOpen}
	<div class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/95 p-6">
		<div class="relative w-full max-w-sm overflow-hidden rounded-lg border border-border">
			<video bind:this={videoEl} class="w-full" muted playsinline></video>
			<div class="pointer-events-none absolute inset-6 rounded-lg border-2 border-primary/70"></div>
		</div>
		<p class="text-sm text-muted-foreground">Point the camera at the asset barcode</p>
		<Button variant="outline" onclick={closeScanner}>Cancel</Button>
	</div>
{/if}
