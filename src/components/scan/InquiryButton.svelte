<script lang="ts">
	import SearchIcon from 'lucide-svelte/icons/search';
	import { inquiry } from '$stores/inquiry';
	import { scanPanel } from '$stores/scanPanel';
	import { inquiryResults } from '$stores/inquiryResults';
	import { cn } from '$lib/utils';

	let containerEl = $state<HTMLDivElement | undefined>();
	let inputEl = $state<HTMLInputElement | null>(null);

	function expand(event?: MouseEvent) {
		event?.stopPropagation();
		inquiry.update((s) => ({ ...s, isExpanded: true }));
	}

	function collapse() {
		inquiry.set({ isExpanded: false, inputValue: '' });
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

	// Results open as floating Inquiry windows (see InquiryResultStack) rather
	// than navigating away, so a run of lookups can stack up side by side.
	function performSearch() {
		const code = $inquiry.inputValue.trim();
		if (!code) return;
		void inquiryResults.lookup(code);
		inquiry.update((s) => ({ ...s, inputValue: '' }));
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
		'fixed bottom-6 right-6 z-50 flex items-center overflow-hidden border transition-all duration-300 ease-in-out',
		$scanPanel.isOpen && 'md:right-[444px]',
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
			placeholder="Scan or enter any code…"
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
			aria-label="Inquiry — look up any asset, location or container (Ctrl+K)"
			title="Inquiry — look up any asset, location or container (Ctrl+K)"
		>
			<SearchIcon class="size-5 text-muted-foreground" />
		</button>
	{/if}
</div>
