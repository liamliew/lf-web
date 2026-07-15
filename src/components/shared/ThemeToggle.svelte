<script lang="ts">
	import SunIcon from 'lucide-svelte/icons/sun';
	import MoonIcon from 'lucide-svelte/icons/moon';
	import { theme } from '$stores/theme';

	function toggle() {
		theme.apply($theme === 'dark' ? 'light' : 'dark');
	}
</script>

<button
	type="button"
	onclick={toggle}
	class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
	aria-label={$theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
>
	{#if $theme === 'dark'}
		<SunIcon class="size-4" />
	{:else}
		<MoonIcon class="size-4" />
	{/if}
</button>
