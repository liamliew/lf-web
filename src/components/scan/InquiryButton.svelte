<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SearchIcon from 'lucide-svelte/icons/search';
	import { inquiry } from '$stores/inquiry';
	import { scanPanel } from '$stores/scanPanel';
	import { supabase } from '$lib/supabase';
	import { soundManager } from '$lib/soundManager';
	import { cn } from '$lib/utils';

	let containerEl = $state<HTMLDivElement | undefined>();
	let inputEl = $state<HTMLInputElement | null>(null);
	let errorMessage = $state('');
	let shake = $state(false);
	let errorTimeout: ReturnType<typeof setTimeout> | undefined;
	let shakeTimeout: ReturnType<typeof setTimeout> | undefined;

	function expand(event?: MouseEvent) {
		event?.stopPropagation();
		inquiry.update((s) => ({ ...s, isExpanded: true }));
	}

	function collapse() {
		inquiry.set({ isExpanded: false, inputValue: '' });
		errorMessage = '';
		clearTimeout(errorTimeout);
		clearTimeout(shakeTimeout);
		shake = false;
	}

	// Focus follows isExpanded regardless of what set it — a local click or
	// the global Ctrl/Cmd+K shortcut in the (app) layout.
	$effect(() => {
		if ($inquiry.isExpanded) {
			queueMicrotask(() => inputEl?.focus());
		}
	});

	function handleWindowClick(event: MouseEvent) {
		if (!$inquiry.isExpanded) return;
		if (containerEl && !containerEl.contains(event.target as Node)) {
			collapse();
		}
	}

	async function performSearch() {
		const code = $inquiry.inputValue.trim();
		if (!code) return;

		const { data: asset } = await supabase
			.from('inventory_assets')
			.select('asset_id')
			.eq('asset_id', code)
			.maybeSingle();

		if (asset) {
			await goto(resolve('/(app)/assets/[id]', { id: asset.asset_id }));
			collapse();
			return;
		}

		const { data: container } = await supabase
			.from('inventory_containers')
			.select('id')
			.eq('container_id', code)
			.maybeSingle();

		if (container) {
			await goto(resolve('/(app)/containers/[id]', { id: container.id }));
			collapse();
			return;
		}

		// Not found
		soundManager.unknownScan();
		errorMessage = `No asset or container found for code '${code}'`;
		shake = true;
		clearTimeout(shakeTimeout);
		shakeTimeout = setTimeout(() => (shake = false), 500);

		clearTimeout(errorTimeout);
		errorTimeout = setTimeout(() => {
			errorMessage = '';
			inquiry.update((s) => ({ ...s, inputValue: '' }));
		}, 2000);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			collapse();
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			performSearch();
		}
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div
	bind:this={containerEl}
	class={cn(
		'fixed bottom-6 right-6 z-50 flex items-center overflow-hidden rounded-full border transition-all duration-300 ease-in-out',
		$scanPanel.isOpen && 'md:right-[444px]',
		shake && 'animate-shake',
		$inquiry.isExpanded
			? 'h-12 w-[280px] justify-start border-primary bg-popover px-3'
			: 'h-[52px] w-[52px] justify-center border-border bg-surface-2'
	)}
>
	{#if $inquiry.isExpanded}
		<SearchIcon class="size-4 shrink-0 text-muted-foreground" />
		<input
			bind:this={inputEl}
			bind:value={$inquiry.inputValue}
			onkeydown={handleKeydown}
			placeholder="Scan or enter asset code..."
			autocomplete="off"
			class="ml-2 min-w-0 flex-1 bg-transparent font-mono-lfc text-sm outline-none placeholder:text-muted-foreground"
		/>
		<button
			type="button"
			onclick={performSearch}
			aria-label="Submit search"
			class="shrink-0 text-xs text-muted-foreground hover:text-foreground focus:outline-none"
		>
			↵
		</button>
	{:else}
		<button
			type="button"
			onclick={expand}
			class="flex size-full items-center justify-center focus:outline-none"
			aria-label="Inquiry — look up any asset (Ctrl+K)"
			title="Inquiry — look up any asset (Ctrl+K)"
		>
			<SearchIcon class="size-5 text-muted-foreground" />
		</button>
	{/if}
</div>

{#if errorMessage}
	<p
		class={cn(
			'fixed bottom-[76px] right-6 z-50 max-w-[280px] rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground shadow-lg',
			$scanPanel.isOpen && 'md:right-[444px]'
		)}
	>
		{errorMessage}
	</p>
{/if}
