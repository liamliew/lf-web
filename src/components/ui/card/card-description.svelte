<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLParagraphElement> & { ref?: HTMLDivElement | null } = $props();
</script>

<p bind:this={ref} class={cn('text-sm text-muted-foreground', className)} {...restProps}>
	{@render children?.()}
</p>
