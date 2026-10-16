<script lang="ts">
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import StatusBadge from '$components/shared/StatusBadge.svelte';
	import XIcon from 'lucide-svelte/icons/x';
	import MapPinIcon from 'lucide-svelte/icons/map-pin';
	import BoxIcon from 'lucide-svelte/icons/box';
	import PackageIcon from 'lucide-svelte/icons/package';
	import UserIcon from 'lucide-svelte/icons/user';
	import CircleHelpIcon from 'lucide-svelte/icons/circle-help';
	import { inquiryResults, type InquiryResult } from '$stores/inquiryResults';

	const CONTENTS_PREVIEW = 8;

	function openTarget(result: InquiryResult) {
		const owner = result.owner;
		if (!owner) return;
		inquiryResults.dismiss(result.id);
		if (owner.kind === 'asset') {
			void goto(resolve('/(app)/assets/[id]', { id: owner.asset.asset_id }));
		} else if (owner.kind === 'location') {
			void goto(resolve('/(app)/locations/[id]', { id: owner.location.id }));
		} else {
			void goto(resolve('/(app)/containers/[id]', { id: owner.container.id }));
		}
	}

	function title(result: InquiryResult): string {
		const owner = result.owner;
		if (!owner) return result.loading ? 'Looking up…' : 'Unknown code';
		if (owner.kind === 'asset') return owner.asset.name;
		if (owner.kind === 'location') return owner.location.name;
		return owner.container.name;
	}

	function kindLabel(result: InquiryResult): string {
		const owner = result.owner;
		if (!owner) return '';
		if (owner.kind === 'asset') return result.containerLocation ? 'Container asset' : 'Asset';
		if (owner.kind === 'location') return owner.location.linked_asset_id ? 'Container' : 'Location';
		return 'Container (legacy)';
	}
</script>

<div
	class="pointer-events-none fixed right-4 top-16 z-[60] flex max-h-[calc(100vh-5rem)] w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto"
	aria-live="polite"
>
	{#each $inquiryResults as result (result.id)}
		<div
			class="pointer-events-auto border border-border border-l-4 bg-popover text-popover-foreground shadow-lg"
			class:border-l-primary={!!result.owner}
			class:border-l-destructive={!result.loading && !result.owner}
			role="dialog"
			aria-label={`Inquiry result for ${result.code}`}
			tabindex="-1"
			onmouseenter={() => inquiryResults.hold(result.id)}
			onmouseleave={() => inquiryResults.release(result.id)}
			in:fly={{ x: 380, duration: 220 }}
			out:fly={{ x: 380, duration: 180 }}
			animate:flip={{ duration: 200 }}
		>
			<div class="flex items-start justify-between gap-2 px-3 pt-3">
				<div class="min-w-0">
					<p class="text-[11px] uppercase tracking-wide text-muted-foreground">
						{result.loading && !result.owner ? 'Scanned' : kindLabel(result) || 'Not found'}
					</p>
					<p class="truncate font-semibold">{title(result)}</p>
					<p class="font-mono-lfc text-xs text-muted-foreground">{result.code}</p>
				</div>
				<button
					type="button"
					class="p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
					aria-label="Dismiss"
					onclick={() => inquiryResults.dismiss(result.id)}
				>
					<XIcon class="size-4" />
				</button>
			</div>

			<div class="space-y-2 px-3 pb-3 pt-2 text-sm">
				{#if result.error}
					<p class="text-destructive">{result.error}</p>
				{:else if !result.loading && !result.owner}
					<p class="flex items-center gap-2 text-muted-foreground">
						<CircleHelpIcon class="size-4" />
						Nothing is registered with this code.
					</p>
				{:else if result.owner}
					{@const owner = result.owner}

					<!-- Where it is — the most important line, so it's the most prominent. -->
					{#if owner.kind === 'asset' && owner.asset.status === 'checked_out'}
						<div class="flex items-center gap-2 bg-surface-2 px-2 py-1.5">
							<UserIcon class="size-4 shrink-0 text-lfc-checked-out" />
							<span class="font-medium"
								>Checked out to {owner.asset.current_user_name ?? 'someone'}</span
							>
						</div>
					{:else if owner.kind !== 'location' || result.whereabouts}
						<div class="flex items-center gap-2 bg-surface-2 px-2 py-1.5">
							<MapPinIcon class="size-4 shrink-0 text-primary" />
							<span class="font-medium">
								{#if owner.kind === 'location'}In {result.whereabouts}
								{:else}{result.whereabouts ?? 'No location recorded'}{/if}
							</span>
						</div>
					{/if}

					{#if owner.kind === 'asset' || owner.kind === 'container'}
						<StatusBadge
							status={owner.kind === 'asset' ? owner.asset.status : owner.container.status}
						/>
					{/if}

					{#if result.contents}
						<div>
							<p class="mb-1 text-xs font-medium text-muted-foreground">
								Contents ({result.contents.length})
							</p>
							{#if result.contents.length === 0}
								<p class="text-xs text-muted-foreground">Empty.</p>
							{:else}
								<ul class="divide-y divide-border border border-border">
									{#each result.contents.slice(0, CONTENTS_PREVIEW) as item (item.asset_id)}
										<li class="flex items-center justify-between gap-2 px-2 py-1 text-xs">
											<span class="flex min-w-0 items-center gap-1.5">
												<PackageIcon class="size-3 shrink-0 text-muted-foreground" />
												<span class="truncate">{item.name}</span>
											</span>
											<span class="font-mono-lfc text-muted-foreground">{item.asset_id}</span>
										</li>
									{/each}
								</ul>
								{#if result.contents.length > CONTENTS_PREVIEW}
									<p class="mt-1 text-xs text-muted-foreground">
										+{result.contents.length - CONTENTS_PREVIEW} more
									</p>
								{/if}
							{/if}
						</div>
					{:else if result.loading}
						<p class="text-xs text-muted-foreground">Loading details…</p>
					{/if}

					<div class="flex gap-2 pt-1">
						<button
							type="button"
							class="border border-border px-2 py-1 text-xs font-medium hover:bg-accent"
							onclick={() => openTarget(result)}
						>
							Open
						</button>
						{#if owner.kind === 'asset' && result.containerLocation}
							{@const containerLoc = result.containerLocation}
							<button
								type="button"
								class="flex items-center gap-1 border border-border px-2 py-1 text-xs font-medium hover:bg-accent"
								onclick={() => {
									inquiryResults.dismiss(result.id);
									void goto(resolve('/(app)/locations/[id]', { id: containerLoc.id }));
								}}
							>
								<BoxIcon class="size-3" />
								Open as location
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>
