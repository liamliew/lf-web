<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { Button } from '$components/ui/button';
	import AssetTable from '$components/assets/AssetTable.svelte';
	import ConfirmDialog from '$components/shared/ConfirmDialog.svelte';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import StatusBadge from '$components/shared/StatusBadge.svelte';
	import LocationFormDialog from '$components/locations/LocationFormDialog.svelte';
	import ArrowLeftIcon from 'lucide-svelte/icons/arrow-left';
	import PencilIcon from 'lucide-svelte/icons/pencil';
	import TrashIcon from 'lucide-svelte/icons/trash';
	import PlusIcon from 'lucide-svelte/icons/plus';
	import BoxIcon from 'lucide-svelte/icons/box';
	import MapPinIcon from 'lucide-svelte/icons/map-pin';
	import { getLocation, getLocations, deleteLocation } from '$services/locationService';
	import { childrenOf, indexLocations, locationChain } from '$lib/locationHierarchy';
	import { notify } from '$stores/toast';
	import type { Asset, Location } from '$lib/types';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	const locationId = $derived(params.id);

	let loading = $state(true);
	let location = $state<Location | null>(null);
	let linkedAsset = $state<Asset | null>(null);
	let assets = $state<Asset[]>([]);
	let allLocations = $state<Location[]>([]);

	let editOpen = $state(false);
	let addChildOpen = $state(false);
	let deleteOpen = $state(false);

	const byId = $derived(indexLocations(allLocations));
	const ancestors = $derived(location ? locationChain(location.id, byId).slice(0, -1) : []);
	const children = $derived(
		location
			? childrenOf(location.id, allLocations).sort((a, b) => a.name.localeCompare(b.name))
			: []
	);

	async function load(id = locationId) {
		loading = true;
		try {
			const [result, locs] = await Promise.all([getLocation(id), getLocations()]);
			if (!result) {
				notify.error('Location not found');
				await goto(resolve('/locations'));
				return;
			}
			const { assets: contents, linkedAsset: linked, ...loc } = result;
			location = loc;
			assets = contents;
			linkedAsset = linked;
			allLocations = locs;
		} catch (err) {
			notify.error('Failed to load location', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	// Re-load whenever the id changes — breadcrumb and sub-location links reuse
	// this component instance. Only `locationId` is tracked; load()'s own
	// state reads/writes are untracked so they can't re-trigger the effect.
	$effect(() => {
		const id = locationId;
		untrack(() => load(id));
	});

	async function handleDelete() {
		if (!location) return;
		try {
			await deleteLocation(location.id);
			notify.success('Location deleted');
			await goto(resolve('/locations'));
		} catch (err) {
			notify.error('Cannot delete location', err instanceof Error ? err.message : undefined);
		}
	}
</script>

<svelte:head>
	<title>{location?.name ?? 'Location'} — Asset Manager</title>
</svelte:head>

<div class="space-y-4">
	<button
		type="button"
		onclick={() => goto(resolve('/locations'))}
		class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-3.5" />
		Back to Locations
	</button>

	{#if loading}
		<LoadingSkeleton rows={6} cols={3} />
	{:else if location}
		<div class="border border-border p-4">
			{#if ancestors.length > 0}
				<nav class="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
					{#each ancestors as ancestor (ancestor.id)}
						<a
							href={resolve('/(app)/locations/[id]', { id: ancestor.id })}
							class="hover:text-foreground hover:underline">{ancestor.name}</a
						>
						<span>›</span>
					{/each}
					<span class="text-foreground">{location.name}</span>
				</nav>
			{/if}
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<div class="flex items-center gap-2">
						{#if location.linked_asset_id}
							<BoxIcon class="size-5 text-primary" aria-label="Container" />
						{/if}
						<h1 class="text-lg font-semibold tracking-tight">{location.name}</h1>
						<span class="font-mono-lfc text-xs text-muted-foreground">{location.code}</span>
					</div>
					<p class="mt-1 text-sm text-muted-foreground">
						{location.description || 'No description'}
					</p>
				</div>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={() => (editOpen = true)}>
						<PencilIcon class="size-4" />
						Edit
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={assets.length > 0 || children.length > 0}
						title={assets.length > 0 || children.length > 0
							? 'Empty this location and move its sub-locations first'
							: undefined}
						onclick={() => (deleteOpen = true)}
					>
						<TrashIcon class="size-4" />
						Delete
					</Button>
				</div>
			</div>

			{#if location.linked_asset_id}
				<div
					class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm"
				>
					<span class="text-muted-foreground">Container asset</span>
					{#if linkedAsset}
						<a
							href={resolve('/(app)/assets/[id]', { id: linkedAsset.asset_id })}
							class="flex items-center gap-2 hover:underline"
						>
							<span class="font-medium">{linkedAsset.name}</span>
							<span class="font-mono-lfc text-xs text-muted-foreground">{linkedAsset.asset_id}</span
							>
							<StatusBadge status={linkedAsset.status} />
						</a>
					{:else}
						<span class="font-mono-lfc text-xs">{location.linked_asset_id}</span>
					{/if}
				</div>
			{/if}
		</div>

		<section class="space-y-2">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-semibold">Sub-locations</h2>
				<Button variant="outline" size="sm" onclick={() => (addChildOpen = true)}>
					<PlusIcon class="size-4" />
					Add sub-location
				</Button>
			</div>
			{#if children.length === 0}
				<p class="text-sm text-muted-foreground">None.</p>
			{:else}
				<div class="border border-border bg-card">
					{#each children as child (child.id)}
						<a
							href={resolve('/(app)/locations/[id]', { id: child.id })}
							class="flex items-center justify-between border-b border-border px-4 py-2 text-sm last:border-b-0 hover:bg-accent"
						>
							<span class="flex items-center gap-2">
								{#if child.linked_asset_id}
									<BoxIcon class="size-4 text-primary" aria-label="Container" />
								{:else}
									<MapPinIcon class="size-4 text-muted-foreground" />
								{/if}
								{child.name}
							</span>
							<span class="font-mono-lfc text-xs text-muted-foreground">{child.code}</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<section class="space-y-2">
			<h2 class="text-sm font-semibold">Contents ({assets.length})</h2>
			<div class="border border-border bg-card">
				<AssetTable {assets} />
			</div>
		</section>
	{/if}
</div>

<LocationFormDialog
	bind:open={editOpen}
	locations={allLocations}
	{location}
	onSaved={() => void load()}
/>

<LocationFormDialog
	bind:open={addChildOpen}
	locations={allLocations}
	defaultParentId={location?.id ?? null}
	onSaved={() => void load()}
/>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete this location?"
	description="This can't be undone."
	confirmLabel="Delete"
	destructive
	onConfirm={handleDelete}
/>
