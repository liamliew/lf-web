<script lang="ts">
	import { slide } from 'svelte/transition';
	import { Badge } from '$components/ui/badge';
	import XIcon from 'lucide-svelte/icons/x';
	import type { ScannedItem } from '$stores/scanPanel';
	import type { Location } from '$lib/types';
	import { formatDate, cn } from '$lib/utils';

	let {
		item,
		expanded = false,
		locationsById,
		onRemove
	}: {
		item: ScannedItem;
		expanded?: boolean;
		locationsById: Record<string, Location>;
		onRemove: () => void;
	} = $props();

	const code = $derived(item.asset?.asset_id ?? item.container?.container_id ?? item.rawCode);
	const truncatedCode = $derived(code.length > 4 ? `${code.slice(0, 4)}..` : code);

	const title = $derived(
		item.isUnknown ? 'Unknown Item' : (item.asset?.name ?? item.container?.name ?? '')
	);
	const subtitle = $derived(
		item.isUnknown
			? 'Not found in system'
			: (item.asset?.type ?? item.asset?.category ?? (item.container ? 'Container' : ''))
	);

	const barColorClass = $derived.by(() => {
		if (item.isUnknown) return 'bg-lfc-lost';
		const status = item.asset?.status ?? item.container?.status;
		switch (status) {
			case 'available':
				return 'bg-lfc-available';
			case 'checked_out':
			case 'rented':
				return 'bg-lfc-checked-out';
			case 'lost':
				return 'bg-lfc-lost';
			default:
				return 'bg-lfc-under-repair';
		}
	});

	const currentUserName = $derived(
		item.asset?.current_user_name ?? item.container?.current_user_name
	);

	function initials(name: string): string {
		return name
			.split(' ')
			.map((part) => part[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	const locationName = $derived.by(() => {
		const locId = item.asset?.current_location_id ?? item.container?.current_location_id;
		return locId ? (locationsById[locId]?.name ?? '—') : '—';
	});
</script>

<div
	class={cn(
		'flex items-stretch overflow-hidden rounded-lg border',
		item.isUnknown ? 'border-[1.5px] border-lfc-lost' : 'border-border'
	)}
>
	<div class={cn('w-1.5 shrink-0', barColorClass)}></div>

	<div class="min-w-0 flex-1 px-3 py-2.5">
		<div class="flex items-start justify-between gap-2">
			<span class="shrink-0 font-mono-lfc text-lg font-bold" title={code}>{truncatedCode}</span>
			<div class="min-w-0 flex-1 text-right">
				<p class={cn('truncate text-sm font-medium', item.isUnknown && 'text-lfc-lost')}>
					{title}
				</p>
				<p
					class={cn(
						'truncate text-xs',
						item.isUnknown ? 'text-lfc-lost/80' : 'text-muted-foreground'
					)}
				>
					{subtitle}
				</p>
			</div>
		</div>

		{#if expanded && !item.isUnknown}
			<div transition:slide={{ duration: 200 }} class="mt-2 border-t border-border pt-2">
				<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
					{#if item.asset}
						<span class="flex items-center gap-1">
							Cost
							<Badge variant="outline" class="font-mono-lfc">{item.asset.cost}</Badge>
						</span>
					{/if}
					{#if currentUserName}
						<span>With: {initials(currentUserName)}</span>
					{/if}
					{#if item.asset?.last_known_at}
						<span>Last seen: {formatDate(item.asset.last_known_at)}</span>
					{/if}
					<span>Location: {locationName}</span>
				</div>
			</div>
		{/if}
	</div>

	<button
		type="button"
		onclick={onRemove}
		class="flex shrink-0 items-center px-2 text-muted-foreground hover:text-lfc-lost"
		aria-label="Remove scanned item"
	>
		<XIcon class="size-4" />
	</button>
</div>
