<script lang="ts">
	import * as Dialog from '$components/ui/dialog';
	import * as Select from '$components/ui/select';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Textarea } from '$components/ui/textarea';
	import ConfirmDialog from '$components/shared/ConfirmDialog.svelte';
	import DicesIcon from 'lucide-svelte/icons/dices';
	import {
		createLocation,
		createContainerLocation,
		convertLocationToContainer,
		updateLocation
	} from '$services/locationService';
	import { generateUniqueAssetId } from '$services/assetService';
	import { indexLocations, locationPath, parentOptions } from '$lib/locationHierarchy';
	import { ASSET_CATEGORIES } from '$lib/constants';
	import { currentUser } from '$stores/auth';
	import { notify } from '$stores/toast';
	import type { Location } from '$lib/types';

	/**
	 * Add/Edit Location — the web counterpart of lf-scan's LocationFormScreen.
	 * Covers free-form parent selection (cycle-safe), the mandatory
	 * container ↔ asset link, and safe code renaming (confirmed before save,
	 * since a changed code stops old printed tags from scanning).
	 */
	let {
		open = $bindable(false),
		locations,
		location = null,
		defaultParentId = null,
		onSaved
	}: {
		open?: boolean;
		locations: Location[];
		/** null → create mode. */
		location?: Location | null;
		defaultParentId?: string | null;
		onSaved?: (location: Location) => void;
	} = $props();

	const NO_PARENT = '__none__';

	let name = $state('');
	let code = $state('');
	let description = $state('');
	let parentId = $state(NO_PARENT);
	let isContainer = $state(false);
	let assetId = $state('');
	let assetName = $state('');
	let assetCategory = $state('');
	let saving = $state(false);
	let renameConfirmOpen = $state(false);

	const isEdit = $derived(location !== null);
	const alreadyContainer = $derived(!!location?.linked_asset_id);
	const byId = $derived(indexLocations(locations));
	const parentChoices = $derived(
		parentOptions(location?.id ?? null, locations)
			.map((l) => ({ id: l.id, label: locationPath(l.id, byId) }))
			.sort((a, b) => a.label.localeCompare(b.label))
	);
	const parentLabel = $derived(
		parentId === NO_PARENT
			? 'None (top level)'
			: (parentChoices.find((p) => p.id === parentId)?.label ?? 'None (top level)')
	);
	const codeChanged = $derived(isEdit && code.trim() !== location?.code);
	const needsNewAsset = $derived(isContainer && !alreadyContainer);

	// Reset the form every time the dialog opens, from whatever it's editing.
	$effect(() => {
		if (!open) return;
		name = location?.name ?? '';
		code = location?.code ?? '';
		description = location?.description ?? '';
		parentId = location?.parent_id ?? defaultParentId ?? NO_PARENT;
		isContainer = alreadyContainer;
		assetId = '';
		assetName = '';
		assetCategory = '';
	});

	async function suggestAssetId() {
		try {
			assetId = await generateUniqueAssetId();
		} catch (err) {
			notify.error('Could not suggest an ID', err instanceof Error ? err.message : undefined);
		}
	}

	$effect(() => {
		if (needsNewAsset && !assetId) void suggestAssetId();
	});

	function validate(): string | null {
		if (!name.trim()) return 'Name is required';
		if (isEdit && !code.trim()) return "Code can't be blank";
		if (needsNewAsset) {
			if (!assetId.trim()) return 'Container asset ID is required';
			if (!assetCategory) return 'Pick a category for the container asset';
		}
		return null;
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const problem = validate();
		if (problem) {
			notify.error(problem);
			return;
		}
		if (codeChanged) {
			renameConfirmOpen = true;
			return;
		}
		void save();
	}

	async function save() {
		const member = $currentUser;
		if (!member) return;
		const performer = { id: member.employeeId, name: member.employeeName };
		const fields = {
			name: name.trim(),
			description: description.trim(),
			parent_id: parentId === NO_PARENT ? null : parentId
		};
		const newAsset = {
			assetId: assetId.trim(),
			name: assetName.trim() || name.trim(),
			category: assetCategory
		};

		saving = true;
		try {
			let saved: Location;
			if (!location) {
				const input = { ...fields, code: code.trim() || undefined };
				saved = needsNewAsset
					? await createContainerLocation(input, newAsset, performer)
					: await createLocation(input);
			} else {
				const updates = { ...fields, ...(codeChanged ? { code: code.trim() } : {}) };
				saved = needsNewAsset
					? await convertLocationToContainer(location.id, updates, newAsset, performer)
					: await updateLocation(location.id, updates);
			}
			notify.success(isEdit ? 'Location updated' : 'Location created');
			open = false;
			onSaved?.(saved);
		} catch (err) {
			notify.error('Failed to save location', err instanceof Error ? err.message : undefined);
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{isEdit ? 'Edit Location' : 'Add Location'}</Dialog.Title>
		</Dialog.Header>
		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="loc-name">Name</Label>
					<Input id="loc-name" bind:value={name} placeholder="Main Warehouse" required />
				</div>
				<div class="space-y-1.5">
					<Label for="loc-code">Code</Label>
					<Input
						id="loc-code"
						bind:value={code}
						class="font-mono-lfc"
						placeholder={isEdit ? '' : 'Auto (LOC-…)'}
					/>
				</div>
			</div>
			{#if codeChanged}
				<p class="text-xs text-lfc-checked-out">
					Changing the code means tags printed with <span class="font-mono-lfc"
						>{location?.code}</span
					> will no longer scan.
				</p>
			{/if}

			<div class="space-y-1.5">
				<Label>Parent location</Label>
				<Select.Root type="single" bind:value={parentId}>
					<Select.Trigger class="w-full">{parentLabel}</Select.Trigger>
					<Select.Content>
						<Select.Item value={NO_PARENT} label="None (top level)" />
						{#each parentChoices as choice (choice.id)}
							<Select.Item value={choice.id} label={choice.label} />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<div class="space-y-1.5">
				<Label for="loc-description">Description</Label>
				<Textarea id="loc-description" bind:value={description} rows={2} />
			</div>

			<div class="space-y-3 border border-border p-3">
				<label class="flex items-start gap-2 text-sm">
					<input
						type="checkbox"
						bind:checked={isContainer}
						disabled={alreadyContainer}
						class="mt-0.5"
					/>
					<span>
						<span class="font-medium">This is a container</span>
						<span class="block text-xs text-muted-foreground">
							A physical drybox, case or bin. Containers are also tracked as an asset so they can be
							checked in and out.
						</span>
					</span>
				</label>

				{#if alreadyContainer}
					<p class="text-xs text-muted-foreground">
						Linked asset: <span class="font-mono-lfc text-foreground"
							>{location?.linked_asset_id}</span
						>
					</p>
				{:else if isContainer}
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1.5">
							<Label for="ctr-asset-id">Asset ID</Label>
							<div class="flex gap-1">
								<Input id="ctr-asset-id" bind:value={assetId} class="font-mono-lfc" />
								<Button
									type="button"
									variant="outline"
									size="icon"
									onclick={suggestAssetId}
									aria-label="Suggest an unused ID"
								>
									<DicesIcon class="size-4" />
								</Button>
							</div>
						</div>
						<div class="space-y-1.5">
							<Label>Category</Label>
							<Select.Root type="single" bind:value={assetCategory}>
								<Select.Trigger class="w-full">{assetCategory || 'Select category'}</Select.Trigger>
								<Select.Content>
									{#each ASSET_CATEGORIES as c (c)}
										<Select.Item value={c} label={c} />
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="col-span-2 space-y-1.5">
							<Label for="ctr-asset-name">Asset name</Label>
							<Input
								id="ctr-asset-name"
								bind:value={assetName}
								placeholder={name.trim() || 'Same as location name'}
							/>
						</div>
					</div>
				{/if}
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)} disabled={saving}>
					Cancel
				</Button>
				<Button type="submit" disabled={saving}>
					{saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<ConfirmDialog
	bind:open={renameConfirmOpen}
	title="Change this location's code?"
	description={`"${location?.code}" → "${code.trim()}". Any tag printed with the old code will stop scanning.`}
	confirmLabel="Change code"
	destructive
	onConfirm={save}
/>
