<script lang="ts">
	import { onMount } from 'svelte';
	import Sidebar from '$components/layout/Sidebar.svelte';
	import TopBar from '$components/layout/TopBar.svelte';
	import MobileNav from '$components/layout/MobileNav.svelte';
	import ScanPanel from '$components/scan/ScanPanel.svelte';
	import InquiryButton from '$components/scan/InquiryButton.svelte';
	import { Toaster } from '$components/ui/sonner';
	import { currentUser } from '$stores/auth';
	import { theme } from '$stores/theme';
	import { scanPanel } from '$stores/scanPanel';
	import { inquiry } from '$stores/inquiry';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	let mobileNavOpen = $state(false);

	const scanMember = $derived(data.member ? { id: data.member.id, name: data.member.name } : null);

	$effect(() => {
		currentUser.setFromMember(data.member ?? null);
	});

	onMount(() => {
		theme.init();
	});

	/**
	 * Global shortcuts for the floating scan panel / inquiry button, active
	 * anywhere in the authenticated app — not just while one of them is
	 * already focused. Ctrl/Cmd+K and Ctrl/Cmd+Shift+S deliberately fire
	 * regardless of what currently has focus (same convention as GitHub/
	 * Linear/Vercel-style command palettes).
	 */
	function handleGlobalKeydown(event: KeyboardEvent) {
		const isMod = event.ctrlKey || event.metaKey;

		if (isMod && !event.shiftKey && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			inquiry.update((s) => ({ ...s, isExpanded: true }));
			return;
		}

		if (isMod && event.shiftKey && event.key.toLowerCase() === 's') {
			event.preventDefault();
			scanPanel.toggle();
			return;
		}

		if (event.key === 'Escape') {
			if ($scanPanel.isOpen) {
				scanPanel.close();
			} else if ($inquiry.isExpanded) {
				inquiry.set({ isExpanded: false, inputValue: '' });
			}
		}
	}
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="flex min-h-screen bg-background">
	<Sidebar />
	<MobileNav bind:open={mobileNavOpen} />

	<div class="flex min-w-0 flex-1 flex-col">
		<TopBar onMenuClick={() => (mobileNavOpen = true)} />
		<main class="flex-1 overflow-x-hidden p-4 md:p-6">
			{@render children?.()}
		</main>
	</div>
</div>

<ScanPanel member={scanMember} />
<InquiryButton />

<Toaster />
