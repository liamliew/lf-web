<script lang="ts">
	import { Skeleton } from '$components/ui/skeleton';

	let { rows = 6, cols = 5 }: { rows?: number; cols?: number } = $props();

	const rowIndexes = $derived(Array.from({ length: rows }, (_, i) => i));
	const colIndexes = $derived(Array.from({ length: cols }, (_, i) => i));
</script>

<div class="w-full space-y-2">
	{#each rowIndexes as rowIndex (rowIndex)}
		<div class="flex items-center gap-4 border-b border-border py-3">
			{#each colIndexes as colIndex (colIndex)}
				<Skeleton class={colIndex === 0 ? 'h-4 w-24' : 'h-4 flex-1'} />
			{/each}
		</div>
	{/each}
</div>
