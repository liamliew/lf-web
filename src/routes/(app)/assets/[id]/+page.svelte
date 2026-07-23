<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Button } from '$components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Textarea } from '$components/ui/textarea';
	import * as Select from '$components/ui/select';
	import * as Dialog from '$components/ui/dialog';
	import { Separator } from '$components/ui/separator';
	import StatusBadge from '$components/shared/StatusBadge.svelte';
	import ConfirmDialog from '$components/shared/ConfirmDialog.svelte';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import ArrowLeftIcon from 'lucide-svelte/icons/arrow-left';
	import PencilIcon from 'lucide-svelte/icons/pencil';
	import ExternalLinkIcon from 'lucide-svelte/icons/external-link';
	import PackageIcon from 'lucide-svelte/icons/package';
	import { getAsset, updateAsset } from '$services/assetService';
	import { removeAssetFromContainer } from '$services/containerService';
	import { getLocations } from '$services/locationService';
	import { notify } from '$stores/toast';
	import { currentUser } from '$stores/auth';
	import { formatDate } from '$lib/utils';
	import type { Asset, Container, CostTier, InventoryEvent, Location, SizeTier } from '$lib/types';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	const assetId = $derived(params.id);

	const SIZES: SizeTier[] = ['S', 'M', 'L'];
	const COSTS: CostTier[] = ['Low', 'Med', 'High'];

	let loading = $state(true);
	let asset = $state<Asset | null>(null);
	let assetLocation = $state<Location | null>(null);
	let container = $state<Container | null>(null);
	let events = $state<InventoryEvent[]>([]);
	let locations = $state<Location[]>([]);

	let editing = $state(false);
	let form = $state({
		name: '',
		category: '',
		type: '',
		size: 'M' as SizeTier,
		cost: 'Med' as CostTier,
		notes: ''
	});
	let saving = $state(false);

	let markLostOpen = $state(false);
	let forceRemoveOpen = $state(false);
	let checkModalOpen = $state(false);
	let checkMode = $state<'check_in' | 'check_out'>('check_in');
	let checkLocationId = $state<string | undefined>(undefined);

	async function load() {
		loading = true;
		try {
			const result = await getAsset(assetId);
			if (!result) {
				notify.error('Asset not found');
				await goto(resolve('/assets'));
				return;
			}
			asset = result;
			assetLocation = result.location;
			container = result.container;
			events = result.events;
			form = {
				name: result.name,
				category: result.category,
				type: result.type ?? '',
				size: (result.size as SizeTier) || 'M',
				cost: (result.cost as CostTier) || 'Med',
				notes: result.notes ?? ''
			};
		} catch (err) {
			notify.error('Failed to load asset', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		locations = await getLocations().catch(() => []);
		await load();
	});

	async function saveEdits() {
		if (!asset) return;
		saving = true;
		try {
			asset = await updateAsset(asset.asset_id, {
				name: form.name.trim(),
				category: form.category.trim(),
				type: form.type.trim() || null,
				size: form.size,
				cost: form.cost,
				notes: form.notes.trim() || null
			});
			editing = false;
			notify.success('Asset updated');
		} catch (err) {
			notify.error('Failed to save', err instanceof Error ? err.message : undefined);
		} finally {
			saving = false;
		}
	}

	function cancelEdit() {
		if (!asset) return;
		form = {
			name: asset.name,
			category: asset.category,
			type: asset.type ?? '',
			size: (asset.size as SizeTier) || 'M',
			cost: (asset.cost as CostTier) || 'Med',
			notes: asset.notes ?? ''
		};
		editing = false;
	}

	async function markLost() {
		if (!asset) return;
		asset = await updateAsset(asset.asset_id, { status: 'lost' });
		notify.success('Asset marked as lost');
	}

	function openCheckModal(mode: 'check_in' | 'check_out') {
		checkMode = mode;
		checkLocationId = asset?.current_location_id ?? undefined;
		checkModalOpen = true;
	}

	async function confirmCheck() {
		if (!asset || !$currentUser) return;
		asset = await updateAsset(asset.asset_id, {
			status: checkMode === 'check_in' ? 'available' : 'checked_out',
			current_user_id: checkMode === 'check_in' ? null : $currentUser.employeeId,
			current_user_name: checkMode === 'check_in' ? null : $currentUser.employeeName,
			current_location_id: checkLocationId ?? asset.current_location_id
		});
		assetLocation = locations.find((l) => l.id === asset?.current_location_id) ?? null;
		checkModalOpen = false;
		notify.success(checkMode === 'check_in' ? 'Checked in' : 'Checked out');
	}

	async function forceRemoveFromContainer() {
		if (!asset || !container || !$currentUser) return;
		await removeAssetFromContainer(
			asset.asset_id,
			container.id,
			$currentUser.employeeId,
			true,
			$currentUser.employeeName
		);
		container = null;
		asset = { ...asset, container_id: null };
		notify.success('Removed from container');
	}

	const osmLink = $derived(
		asset?.last_known_lat && asset?.last_known_lng
			? `https://www.openstreetmap.org/?mlat=${asset.last_known_lat}&mlon=${asset.last_known_lng}#map=16/${asset.last_known_lat}/${asset.last_known_lng}`
			: null
	);

	const selectedCheckLocationLabel = $derived(
		locations.find((l) => l.id === checkLocationId)?.name ?? 'Select location'
	);
</script>

<svelte:head>
	<title>{asset?.name ?? 'Asset'} — Asset Manager</title>
</svelte:head>

<div class="space-y-4">
	<button
		type="button"
		onclick={() => goto(resolve('/assets'))}
		class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-3.5" />
		Back to Assets
	</button>

	{#if loading}
		<LoadingSkeleton rows={6} cols={3} />
	{:else if asset}
		<div
			class="flex items-center justify-between rounded-lg border border-border px-4 py-2"
			style="background: color-mix(in srgb, currentColor 8%, transparent);"
		>
			<div class="flex items-center gap-3">
				<StatusBadge status={asset.status} />
				<span class="font-mono-lfc text-xs text-muted-foreground">{asset.asset_id}</span>
			</div>
			<span class="text-xs text-muted-foreground">
				Last seen {asset.last_known_at ? formatDate(asset.last_known_at) : 'never'}
			</span>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div class="space-y-4 lg:col-span-2">
				{#if asset.photo_urls && asset.photo_urls.length > 0}
					<div class="grid grid-cols-3 gap-2">
						{#each asset.photo_urls as url (url)}
							<img
								src={url}
								alt={asset.name}
								class="aspect-square w-full rounded-md object-cover"
							/>
						{/each}
					</div>
				{:else}
					<div
						class="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground"
					>
						<PackageIcon class="size-8" />
					</div>
				{/if}

				<Card>
					<CardHeader class="flex flex-row items-center justify-between">
						<CardTitle>Details</CardTitle>
						{#if !editing}
							<Button variant="outline" size="sm" onclick={() => (editing = true)}>
								<PencilIcon class="size-4" />
								Edit
							</Button>
						{/if}
					</CardHeader>
					<CardContent class="space-y-4">
						{#if editing}
							<div class="grid grid-cols-2 gap-3">
								<div class="space-y-1.5">
									<Label for="edit-name">Name</Label>
									<Input id="edit-name" bind:value={form.name} />
								</div>
								<div class="space-y-1.5">
									<Label for="edit-category">Category</Label>
									<Input id="edit-category" bind:value={form.category} />
								</div>
								<div class="space-y-1.5">
									<Label for="edit-type">Type</Label>
									<Input id="edit-type" bind:value={form.type} />
								</div>
								<div class="space-y-1.5">
									<Label>Size</Label>
									<Select.Root type="single" bind:value={form.size}>
										<Select.Trigger class="w-full">{form.size}</Select.Trigger>
										<Select.Content>
											{#each SIZES as s (s)}
												<Select.Item value={s} label={s} />
											{/each}
										</Select.Content>
									</Select.Root>
								</div>
								<div class="space-y-1.5">
									<Label>Cost</Label>
									<Select.Root type="single" bind:value={form.cost}>
										<Select.Trigger class="w-full">{form.cost}</Select.Trigger>
										<Select.Content>
											{#each COSTS as c (c)}
												<Select.Item value={c} label={c} />
											{/each}
										</Select.Content>
									</Select.Root>
								</div>
							</div>
							<div class="space-y-1.5">
								<Label for="edit-notes">Notes</Label>
								<Textarea id="edit-notes" rows={3} bind:value={form.notes} />
							</div>
							<div class="flex justify-end gap-2">
								<Button variant="outline" onclick={cancelEdit} disabled={saving}>Cancel</Button>
								<Button onclick={saveEdits} disabled={saving}>
									{saving ? 'Saving…' : 'Save'}
								</Button>
							</div>
						{:else}
							<dl class="grid grid-cols-2 gap-y-3 text-sm">
								<dt class="text-muted-foreground">Name</dt>
								<dd class="text-right font-medium">{asset.name}</dd>
								<dt class="text-muted-foreground">Category</dt>
								<dd class="text-right">{asset.category}</dd>
								<dt class="text-muted-foreground">Type</dt>
								<dd class="text-right">{asset.type ?? '—'}</dd>
								<dt class="text-muted-foreground">Size</dt>
								<dd class="text-right">{asset.size}</dd>
								<dt class="text-muted-foreground">Cost</dt>
								<dd class="text-right">{asset.cost}</dd>
								<dt class="text-muted-foreground">Serial Number</dt>
								<dd class="text-right font-mono-lfc">{asset.serial_number ?? '—'}</dd>
								{#if asset.notes}
									<dt class="text-muted-foreground">Notes</dt>
									<dd class="text-right">{asset.notes}</dd>
								{/if}
							</dl>
						{/if}
					</CardContent>
				</Card>

				{#if container}
					<Card>
						<CardHeader>
							<CardTitle>Container</CardTitle>
						</CardHeader>
						<CardContent class="flex items-center justify-between">
							<button
								type="button"
								class="text-sm font-medium hover:underline"
								onclick={() =>
									container && goto(resolve('/(app)/containers/[id]', { id: container.id }))}
							>
								{container.name}
							</button>
							<Button variant="outline" size="sm" onclick={() => (forceRemoveOpen = true)}>
								Force Remove
							</Button>
						</CardContent>
					</Card>
				{/if}

				<Card>
					<CardHeader>
						<CardTitle>Location</CardTitle>
					</CardHeader>
					<CardContent class="space-y-2 text-sm">
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground">Assigned location</span>
							<span>{assetLocation?.name ?? '—'}</span>
						</div>
						{#if osmLink}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- external OpenStreetMap URL, not an internal route -->
							<a
								href={osmLink}
								target="_blank"
								rel="noreferrer"
								class="flex items-center gap-1 text-primary hover:underline"
							>
								Last known GPS location
								<ExternalLinkIcon class="size-3.5" />
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/if}
					</CardContent>
				</Card>

				<div class="flex flex-wrap gap-2">
					{#if asset.status === 'available'}
						<Button onclick={() => openCheckModal('check_out')}>Check Out</Button>
					{:else if asset.status === 'checked_out'}
						<Button onclick={() => openCheckModal('check_in')}>Check In</Button>
					{/if}
					{#if asset.status !== 'lost'}
						<Button variant="destructive" onclick={() => (markLostOpen = true)}>Mark Lost</Button>
					{/if}
				</div>
			</div>

			<div>
				<Card>
					<CardHeader>
						<CardTitle>Activity</CardTitle>
					</CardHeader>
					<CardContent>
						{#if events.length === 0}
							<p class="text-sm text-muted-foreground">No activity yet.</p>
						{:else}
							<ol class="space-y-4">
								{#each events as event (event.id)}
									<li class="space-y-0.5 text-sm">
										<p class="font-medium capitalize">{event.event_type.replace(/_/g, ' ')}</p>
										<p class="text-xs text-muted-foreground">
											{event.performed_by_name ?? 'System'} · {formatDate(event.created_at)}
										</p>
										{#if event.note}
											<p class="text-xs text-muted-foreground">{event.note}</p>
										{/if}
									</li>
									{#if event !== events[events.length - 1]}
										<Separator />
									{/if}
								{/each}
							</ol>
						{/if}
					</CardContent>
				</Card>
			</div>
		</div>
	{/if}
</div>

<ConfirmDialog
	bind:open={markLostOpen}
	title="Mark this asset as lost?"
	description="This will flag the asset as lost until it's found and checked back in."
	confirmLabel="Mark Lost"
	destructive
	onConfirm={markLost}
/>

<ConfirmDialog
	bind:open={forceRemoveOpen}
	title="Force remove from container?"
	description="This removes the asset from its container regardless of its current state."
	confirmLabel="Force Remove"
	destructive
	onConfirm={forceRemoveFromContainer}
/>

<Dialog.Root bind:open={checkModalOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{checkMode === 'check_in' ? 'Check In' : 'Check Out'} Asset</Dialog.Title>
			<Dialog.Description>Select the location for this asset.</Dialog.Description>
		</Dialog.Header>
		<Select.Root type="single" bind:value={checkLocationId}>
			<Select.Trigger class="w-full">
				{selectedCheckLocationLabel}
			</Select.Trigger>
			<Select.Content>
				{#each locations as location (location.id)}
					<Select.Item value={location.id} label={location.name} />
				{/each}
			</Select.Content>
		</Select.Root>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (checkModalOpen = false)}>Cancel</Button>
			<Button onclick={confirmCheck}>Confirm</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
