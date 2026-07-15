<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Table from '$components/ui/table';
	import StatusBadge from '$components/shared/StatusBadge.svelte';
	import EmptyState from '$components/shared/EmptyState.svelte';
	import PackageIcon from 'lucide-svelte/icons/package';
	import ArrowUpIcon from 'lucide-svelte/icons/arrow-up';
	import ArrowDownIcon from 'lucide-svelte/icons/arrow-down';
	import type { Asset, Location } from '$lib/types';
	import { formatDate } from '$lib/utils';

	export type SortKey =
		'asset_id' | 'name' | 'category' | 'size' | 'cost' | 'status' | 'last_known_at';

	let {
		assets,
		locationsById = {},
		sortKey = $bindable<SortKey>('name'),
		sortAsc = $bindable(true)
	}: {
		assets: Asset[];
		locationsById?: Record<string, Location>;
		sortKey?: SortKey;
		sortAsc?: boolean;
	} = $props();

	const columns: { key: SortKey; label: string }[] = [
		{ key: 'asset_id', label: 'Asset ID' },
		{ key: 'name', label: 'Name' },
		{ key: 'category', label: 'Category' },
		{ key: 'size', label: 'Size' },
		{ key: 'cost', label: 'Cost' },
		{ key: 'status', label: 'Status' },
		{ key: 'last_known_at', label: 'Last Seen' }
	];

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortAsc = !sortAsc;
		} else {
			sortKey = key;
			sortAsc = true;
		}
	}

	function rowClick(asset: Asset) {
		goto(resolve('/(app)/assets/[id]', { id: asset.asset_id }));
	}
</script>

{#if assets.length === 0}
	<EmptyState
		icon={PackageIcon}
		title="No assets found"
		description="Try adjusting your filters."
	/>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				{#each columns as col (col.key)}
					<Table.Head>
						<button
							type="button"
							class="flex items-center gap-1 hover:text-foreground"
							onclick={() => toggleSort(col.key)}
						>
							{col.label}
							{#if sortKey === col.key}
								{#if sortAsc}
									<ArrowUpIcon class="size-3" />
								{:else}
									<ArrowDownIcon class="size-3" />
								{/if}
							{/if}
						</button>
					</Table.Head>
				{/each}
				<Table.Head>Location</Table.Head>
				<Table.Head>Currently With</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each assets as asset (asset.asset_id)}
				<Table.Row class="cursor-pointer" onclick={() => rowClick(asset)}>
					<Table.Cell class="font-mono-lfc text-xs text-muted-foreground"
						>{asset.asset_id}</Table.Cell
					>
					<Table.Cell class="font-medium">{asset.name}</Table.Cell>
					<Table.Cell>{asset.category}</Table.Cell>
					<Table.Cell>{asset.size}</Table.Cell>
					<Table.Cell>{asset.cost}</Table.Cell>
					<Table.Cell><StatusBadge status={asset.status} /></Table.Cell>
					<Table.Cell class="text-muted-foreground">
						{asset.last_known_at ? formatDate(asset.last_known_at) : '—'}
					</Table.Cell>
					<Table.Cell>
						{asset.current_location_id
							? (locationsById[asset.current_location_id]?.name ?? '—')
							: '—'}
					</Table.Cell>
					<Table.Cell>{asset.current_user_name ?? '—'}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
