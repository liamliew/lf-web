<script lang="ts">
	import type { HTMLTdAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: HTMLTdAttributes & { ref?: HTMLTableCellElement | null } = $props();
</script>

<td
	bind:this={ref}
	class={cn('whitespace-nowrap px-2 py-2 align-middle [&:has([role=checkbox])]:pr-0', className)}
	{...restProps}
>
	{@render children?.()}
</td>
