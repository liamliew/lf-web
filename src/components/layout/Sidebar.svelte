<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import PackageIcon from 'lucide-svelte/icons/package';
	import ArchiveIcon from 'lucide-svelte/icons/archive';
	import MapPinIcon from 'lucide-svelte/icons/map-pin';
	import ClipboardCheckIcon from 'lucide-svelte/icons/clipboard-check';
	import ActivityIcon from 'lucide-svelte/icons/activity';
	import UsersIcon from 'lucide-svelte/icons/users';
	import SettingsIcon from 'lucide-svelte/icons/settings';
	import LogOutIcon from 'lucide-svelte/icons/log-out';
	import { Badge } from '$components/ui/badge';
	import { currentUser } from '$stores/auth';
	import { supabase } from '$lib/supabase';
	import { cn } from '$lib/utils';

	const navItems = [
		{ label: 'Assets', href: resolve('/assets'), icon: PackageIcon },
		{ label: 'Containers', href: resolve('/containers'), icon: ArchiveIcon },
		{ label: 'Locations', href: resolve('/locations'), icon: MapPinIcon },
		{ label: 'Audit', href: resolve('/audit'), icon: ClipboardCheckIcon },
		{ label: 'Activity', href: resolve('/activity'), icon: ActivityIcon },
		{ label: 'Team', href: resolve('/team'), icon: UsersIcon },
		{ label: 'Settings', href: resolve('/settings'), icon: SettingsIcon }
	];

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}

	async function signOut() {
		currentUser.clear();
		await supabase.auth.signOut();
		// Hard navigation so hooks.server.ts re-evaluates from a clean slate.
		window.location.href = resolve('/login');
	}
</script>

<aside
	class="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface md:flex"
>
	<div class="flex h-14 items-center gap-2 border-b border-border px-4">
		<div
			class="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
		>
			LF
		</div>
		<span class="text-sm font-semibold tracking-tight">LF Inventory</span>
	</div>

	<nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
		{#each navItems as item (item.href)}
			<a
				href={item.href}
				class={cn(
					'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
					isActive(item.href)
						? 'bg-primary/15 text-primary'
						: 'text-muted-foreground hover:bg-accent hover:text-foreground'
				)}
			>
				<item.icon class="size-4" />
				{item.label}
			</a>
		{/each}
	</nav>

	{#if $currentUser}
		<div class="border-t border-border p-3">
			<div class="flex items-center justify-between gap-2 rounded-md px-2 py-2">
				<div class="min-w-0">
					<p class="truncate text-sm font-medium">{$currentUser.employeeName}</p>
					<Badge variant="outline" class="mt-1 font-mono-lfc text-[10px]"
						>{$currentUser.employeeRole}</Badge
					>
				</div>
				<button
					type="button"
					onclick={signOut}
					class="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
					aria-label="Sign out"
				>
					<LogOutIcon class="size-4" />
				</button>
			</div>
		</div>
	{/if}
</aside>
