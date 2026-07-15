<script lang="ts">
	import type { Snippet, ComponentType, SvelteComponent } from 'svelte';
	import type { IconProps } from 'lucide-svelte';

	let {
		icon: Icon,
		title,
		description,
		action
	}: {
		icon?: ComponentType<SvelteComponent<IconProps>>;
		title: string;
		description?: string;
		action?: Snippet;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
	{#if Icon}
		<div class="flex size-12 items-center justify-center rounded-full bg-muted">
			<Icon class="size-6 text-muted-foreground" />
		</div>
	{/if}
	<div class="space-y-1">
		<p class="text-sm font-medium">{title}</p>
		{#if description}
			<p class="text-sm text-muted-foreground">{description}</p>
		{/if}
	</div>
	{#if action}
		<div class="mt-2">
			{@render action()}
		</div>
	{/if}
</div>
