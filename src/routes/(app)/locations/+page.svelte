<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import EmptyState from '$components/shared/EmptyState.svelte';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import LocationFormDialog from '$components/locations/LocationFormDialog.svelte';
	import PlusIcon from 'lucide-svelte/icons/plus';
	import MapPinIcon from 'lucide-svelte/icons/map-pin';
	import BoxIcon from 'lucide-svelte/icons/box';
	import CornerDownRightIcon from 'lucide-svelte/icons/corner-down-right';
	import { getLocations } from '$services/locationService';
	import { getAssets } from '$services/assetService';
	import { flattenTree } from '$lib/locationHierarchy';
	import { notify } from '$stores/toast';
	import type { Location } from '$lib/types';

	let loading = $state(true);
	let locations = $state<Location[]>([]);
	let assetCounts = $state<Record<string, number>>({});
	let search = $state('');
	let dialogOpen = $state(false);

	const tree = $derived(flattenTree(locations));
	const visibleRows = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return tree;
		return tree.filter(
			({ location }) =>
				location.name.toLowerCase().includes(q) || location.code.toLowerCase().includes(q)
		);
	});

	async function load() {
		loading = true;
		try {
			const [locs, assets] = await Promise.all([getLocations(), getAssets()]);
			locations = locs;
			const counts: Record<string, number> = {};
			for (const asset of assets) {
				if (asset.current_location_id) {
					counts[asset.current_location_id] = (counts[asset.current_location_id] ?? 0) + 1;
				}
			}
			assetCounts = counts;
		} catch (err) {
			notify.error('Failed to load locations', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	onMount(load);
</script>

<svelte:head>
	<title>Locations — Asset Manager</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-lg font-semibold tracking-tight">Locations</h1>
		<div class="flex gap-2">
			<Input bind:value={search} placeholder="Search name or code…" class="w-56" />
			<Button onclick={() => (dialogOpen = true)}>
				<PlusIcon class="size-4" />
				Add Location
			</Button>
		</div>
	</div>

	{#if loading}
		<LoadingSkeleton rows={4} cols={3} />
	{:else if locations.length === 0}
		<EmptyState
			icon={MapPinIcon}
			title="No locations yet"
			description="Add your first location to start assigning assets."
		/>
	{:else}
		<div class="border border-border bg-card">
			<div
				class="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
			>
				<span>Location</span>
				<span>Code</span>
				<span class="w-20 text-right">Assets</span>
			</div>
			{#each visibleRows as { location, depth } (location.id)}
				<button
					type="button"
					class="grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent"
					onclick={() => goto(resolve('/(app)/locations/[id]', { id: location.id }))}
				>
					<span
						class="flex min-w-0 items-center gap-2"
						style={`padding-left: ${search ? 0 : depth * 1.25}rem`}
					>
						{#if depth > 0 && !search}
							<CornerDownRightIcon class="size-3.5 shrink-0 text-muted-foreground" />
						{/if}
						{#if location.linked_asset_id}
							<BoxIcon class="size-4 shrink-0 text-primary" aria-label="Container" />
						{:else}
							<MapPinIcon class="size-4 shrink-0 text-muted-foreground" />
						{/if}
						<span class="truncate font-medium">{location.name}</span>
					</span>
					<span class="font-mono-lfc text-xs text-muted-foreground">{location.code}</span>
					<span class="w-20 text-right tabular-nums">{assetCounts[location.id] ?? 0}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<LocationFormDialog
	bind:open={dialogOpen}
	{locations}
	onSaved={(saved) => goto(resolve('/(app)/locations/[id]', { id: saved.id }))}
/>
