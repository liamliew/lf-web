<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Textarea } from '$components/ui/textarea';
	import * as Select from '$components/ui/select';
	import XIcon from 'lucide-svelte/icons/x';
	import DicesIcon from 'lucide-svelte/icons/dices';
	import { createAsset, generateUniqueAssetId } from '$services/assetService';
	import { notify } from '$stores/toast';
	import type { Asset, CostTier, Location, SizeTier } from '$lib/types';

	let {
		open = $bindable(false),
		locations = [],
		onCreated
	}: {
		open?: boolean;
		locations?: Location[];
		onCreated?: (asset: Asset) => void;
	} = $props();

	const CATEGORIES = ['Camera', 'Lens', 'Lighting', 'Audio', 'Support', 'Bag', 'Storage', 'Other'];
	const SIZES: SizeTier[] = ['S', 'M', 'L'];
	const COSTS: CostTier[] = ['Low', 'Med', 'High'];

	let assetId = $state('');
	let name = $state('');
	let category = $state('Other');
	let type = $state('');
	let size = $state<SizeTier>('M');
	let cost = $state<CostTier>('Med');
	let locationId = $state<string | undefined>(undefined);
	let notes = $state('');
	let submitting = $state(false);
	let generatingId = $state(false);

	const selectedLocationLabel = $derived(
		locations.find((l) => l.id === locationId)?.name ?? 'Select location'
	);

	function reset() {
		assetId = '';
		name = '';
		category = 'Other';
		type = '';
		size = 'M';
		cost = 'Med';
		locationId = undefined;
		notes = '';
	}

	async function handleGenerateId() {
		generatingId = true;
		try {
			assetId = await generateUniqueAssetId();
		} catch (err) {
			notify.error('Failed to generate ID', err instanceof Error ? err.message : undefined);
		} finally {
			generatingId = false;
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!assetId.trim() || !name.trim()) {
			notify.error('Asset ID and name are required');
			return;
		}

		submitting = true;
		try {
			const asset = await createAsset({
				asset_id: assetId.trim(),
				name: name.trim(),
				category,
				type: type.trim() || undefined,
				size,
				cost,
				current_location_id: locationId,
				notes: notes.trim() || undefined
			});
			notify.success('Asset created', asset.name);
			onCreated?.(asset);
			reset();
			open = false;
		} catch (err) {
			notify.error('Failed to create asset', err instanceof Error ? err.message : undefined);
		} finally {
			submitting = false;
		}
	}
</script>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
		/>
		<DialogPrimitive.Content
			class="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-popover shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
		>
			<div class="flex items-center justify-between border-b border-border px-6 py-4">
				<DialogPrimitive.Title class="text-base font-semibold">Add Asset</DialogPrimitive.Title>
				<DialogPrimitive.Close
					class="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
				>
					<XIcon class="size-4" />
				</DialogPrimitive.Close>
			</div>

			<form onsubmit={handleSubmit} class="flex flex-1 flex-col overflow-y-auto">
				<div class="flex-1 space-y-4 px-6 py-4">
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1.5">
							<Label for="asset-id">Asset ID</Label>
							<div class="flex gap-1.5">
								<Input
									id="asset-id"
									bind:value={assetId}
									placeholder="e.g. 2817"
									class="font-mono-lfc"
									required
								/>
								<Button
									type="button"
									variant="outline"
									size="icon"
									class="shrink-0"
									disabled={generatingId}
									onclick={handleGenerateId}
									title="Generate a random unused ID"
									aria-label="Generate a random unused ID"
								>
									<DicesIcon class={generatingId ? 'size-4 animate-spin' : 'size-4'} />
								</Button>
							</div>
						</div>
						<div class="space-y-1.5">
							<Label for="asset-serial">Type</Label>
							<Input id="asset-serial" bind:value={type} placeholder="Camera Body" />
						</div>
					</div>

					<div class="space-y-1.5">
						<Label for="asset-name">Name</Label>
						<Input
							id="asset-name"
							bind:value={name}
							placeholder="e.g. Sony FX6 Camera Body"
							required
						/>
					</div>

					<div class="space-y-1.5">
						<Label>Category</Label>
						<Select.Root type="single" bind:value={category}>
							<Select.Trigger class="w-full">{category}</Select.Trigger>
							<Select.Content>
								{#each CATEGORIES as c (c)}
									<Select.Item value={c} label={c} />
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1.5">
							<Label>Size</Label>
							<Select.Root type="single" bind:value={size}>
								<Select.Trigger class="w-full">{size}</Select.Trigger>
								<Select.Content>
									{#each SIZES as s (s)}
										<Select.Item value={s} label={s} />
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-1.5">
							<Label>Cost</Label>
							<Select.Root type="single" bind:value={cost}>
								<Select.Trigger class="w-full">{cost}</Select.Trigger>
								<Select.Content>
									{#each COSTS as c (c)}
										<Select.Item value={c} label={c} />
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</div>

					<div class="space-y-1.5">
						<Label>Location</Label>
						<Select.Root type="single" bind:value={locationId}>
							<Select.Trigger class="w-full">
								{selectedLocationLabel}
							</Select.Trigger>
							<Select.Content>
								{#each locations as location (location.id)}
									<Select.Item value={location.id} label={location.name} />
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<div class="space-y-1.5">
						<Label for="asset-notes">Notes</Label>
						<Textarea id="asset-notes" bind:value={notes} rows={3} />
					</div>
				</div>

				<div class="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
					<Button
						type="button"
						variant="outline"
						onclick={() => (open = false)}
						disabled={submitting}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={submitting}>
						{submitting ? 'Creating…' : 'Create Asset'}
					</Button>
				</div>
			</form>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
