<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Card } from '$components/ui/card';
	import StatusBadge from '$components/shared/StatusBadge.svelte';
	import type { Asset } from '$lib/types';
	import type { Snippet } from 'svelte';

	let { asset, actions }: { asset: Asset; actions?: Snippet } = $props();
</script>

<Card class="flex items-center justify-between gap-4 p-3">
	<button
		type="button"
		class="flex min-w-0 flex-1 items-center gap-3 text-left"
		onclick={() => goto(resolve('/(app)/assets/[id]', { id: asset.asset_id }))}
	>
		<div class="min-w-0">
			<p class="truncate text-sm font-medium">{asset.name}</p>
			<p class="truncate font-mono-lfc text-xs text-muted-foreground">
				{asset.asset_id} · {asset.category}
			</p>
		</div>
	</button>

	<div class="flex shrink-0 items-center gap-3">
		<span class="font-mono-lfc text-xs text-muted-foreground">{asset.cost}</span>
		<StatusBadge status={asset.status} />
		{#if actions}
			{@render actions()}
		{/if}
	</div>
</Card>
