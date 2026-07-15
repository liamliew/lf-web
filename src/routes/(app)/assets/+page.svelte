<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import * as Tabs from '$components/ui/tabs';
	import AssetTable from '$components/assets/AssetTable.svelte';
	import AssetDrawer from '$components/assets/AssetDrawer.svelte';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import PlusIcon from 'lucide-svelte/icons/plus';
	import DownloadIcon from 'lucide-svelte/icons/download';
	import SearchIcon from 'lucide-svelte/icons/search';
	import ChevronLeftIcon from 'lucide-svelte/icons/chevron-left';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
	import { getAssets } from '$services/assetService';
	import { getLocations } from '$services/locationService';
	import { notify } from '$stores/toast';
	import { debounce } from '$lib/utils';
	import type { Asset, AssetStatus, Location } from '$lib/types';
	import type { SortKey } from '$components/assets/AssetTable.svelte';

	const PAGE_SIZE = 25;

	let loading = $state(true);
	let assets = $state<Asset[]>([]);
	let locations = $state<Location[]>([]);

	let search = $state('');
	let statusFilter = $state<AssetStatus | 'all'>('all');
	let page = $state(1);
	let drawerOpen = $state(false);

	let sortKey = $state<SortKey>('name');
	let sortAsc = $state(true);

	const locationsById = $derived(Object.fromEntries(locations.map((l) => [l.id, l])));

	async function load() {
		loading = true;
		try {
			assets = await getAssets({
				status: statusFilter,
				search: search || undefined
			});
			page = 1;
		} catch (err) {
			notify.error('Failed to load assets', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	const debouncedLoad = debounce(() => load(), 300);

	onMount(async () => {
		try {
			locations = await getLocations();
		} catch {
			// non-fatal — table still renders with raw IDs
		}
		await load();
	});

	function onSearchInput() {
		debouncedLoad();
	}

	function onTabChange(value: string) {
		statusFilter = value as AssetStatus | 'all';
		load();
	}

	const sorted = $derived(
		[...assets].sort((a, b) => {
			const dir = sortAsc ? 1 : -1;
			const av = a[sortKey as keyof Asset];
			const bv = b[sortKey as keyof Asset];
			if (av === null || av === undefined) return 1;
			if (bv === null || bv === undefined) return -1;
			if (av < bv) return -1 * dir;
			if (av > bv) return 1 * dir;
			return 0;
		})
	);

	const totalPages = $derived(Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)));
	const paginated = $derived(sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));

	function exportCsv() {
		const header = [
			'Asset ID',
			'Name',
			'Category',
			'Type',
			'Size',
			'Cost',
			'Status',
			'Location',
			'Last Seen',
			'Currently With'
		];
		const rows = sorted.map((asset) => [
			asset.asset_id,
			asset.name,
			asset.category,
			asset.type ?? '',
			asset.size,
			asset.cost,
			asset.status,
			asset.current_location_id ? (locationsById[asset.current_location_id]?.name ?? '') : '',
			asset.last_known_at ?? '',
			asset.current_user_name ?? ''
		]);
		const csv = [header, ...rows]
			.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
			.join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `assets-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleCreated(asset: Asset) {
		assets = [asset, ...assets];
	}
</script>

<svelte:head>
	<title>Assets — LF Inventory</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-lg font-semibold tracking-tight">Assets</h1>
		<div class="flex items-center gap-2">
			<Button variant="outline" onclick={exportCsv}>
				<DownloadIcon class="size-4" />
				Export
			</Button>
			<Button onclick={() => (drawerOpen = true)}>
				<PlusIcon class="size-4" />
				Add Asset
			</Button>
		</div>
	</div>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<Tabs.Root value={statusFilter} onValueChange={onTabChange}>
			<Tabs.List>
				<Tabs.Trigger value="all">All</Tabs.Trigger>
				<Tabs.Trigger value="available">Available</Tabs.Trigger>
				<Tabs.Trigger value="checked_out">Checked Out</Tabs.Trigger>
				<Tabs.Trigger value="lost">Lost</Tabs.Trigger>
				<Tabs.Trigger value="repair">Under Repair</Tabs.Trigger>
				<Tabs.Trigger value="rented">Rented</Tabs.Trigger>
			</Tabs.List>
		</Tabs.Root>

		<div class="relative w-full max-w-xs">
			<SearchIcon class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				bind:value={search}
				oninput={onSearchInput}
				placeholder="Search by name or ID…"
				class="pl-8"
			/>
		</div>
	</div>

	<div class="rounded-lg border border-border bg-card">
		{#if loading}
			<div class="p-4">
				<LoadingSkeleton rows={8} cols={9} />
			</div>
		{:else}
			<AssetTable assets={paginated} {locationsById} bind:sortKey bind:sortAsc />
		{/if}
	</div>

	{#if !loading && sorted.length > 0}
		<div class="flex items-center justify-between text-sm text-muted-foreground">
			<span>
				Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
			</span>
			<div class="flex items-center gap-2">
				<Button variant="outline" size="sm" disabled={page <= 1} onclick={() => (page -= 1)}>
					<ChevronLeftIcon class="size-4" />
					Prev
				</Button>
				<span>Page {page} / {totalPages}</span>
				<Button
					variant="outline"
					size="sm"
					disabled={page >= totalPages}
					onclick={() => (page += 1)}
				>
					Next
					<ChevronRightIcon class="size-4" />
				</Button>
			</div>
		</div>
	{/if}
</div>

<AssetDrawer bind:open={drawerOpen} {locations} onCreated={handleCreated} />
