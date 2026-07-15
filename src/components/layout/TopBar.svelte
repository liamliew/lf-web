<script lang="ts">
	import { page } from '$app/state';
	import MenuIcon from 'lucide-svelte/icons/menu';
	import BellIcon from 'lucide-svelte/icons/bell';
	import { Avatar, AvatarFallback } from '$components/ui/avatar';
	import ThemeToggle from '$components/shared/ThemeToggle.svelte';
	import { currentUser } from '$stores/auth';

	let { onMenuClick }: { onMenuClick?: () => void } = $props();

	function initials(name: string): string {
		return name
			.split(' ')
			.map((part) => part[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	const breadcrumb = $derived(
		page.url.pathname
			.split('/')
			.filter(Boolean)
			.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
			.join(' / ') || 'Assets'
	);
</script>

<header
	class="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur"
>
	<div class="flex items-center gap-3">
		<button
			type="button"
			class="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
			onclick={() => onMenuClick?.()}
			aria-label="Toggle navigation"
		>
			<MenuIcon class="size-5" />
		</button>
		<span class="text-sm font-medium text-muted-foreground">{breadcrumb}</span>
	</div>

	<div class="flex items-center gap-3">
		<ThemeToggle />

		<button
			type="button"
			class="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
			aria-label="Notifications"
		>
			<BellIcon class="size-4" />
		</button>

		{#if $currentUser}
			<div class="flex items-center gap-2">
				<Avatar class="size-8">
					<AvatarFallback class="bg-primary/15 text-xs text-primary"
						>{initials($currentUser.employeeName)}</AvatarFallback
					>
				</Avatar>
				<span class="hidden text-sm font-medium sm:inline">{$currentUser.employeeName}</span>
			</div>
		{/if}
	</div>
</header>
