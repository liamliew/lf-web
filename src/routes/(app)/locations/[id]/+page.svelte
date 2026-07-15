<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Textarea } from '$components/ui/textarea';
	import AssetTable from '$components/assets/AssetTable.svelte';
	import ConfirmDialog from '$components/shared/ConfirmDialog.svelte';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import ArrowLeftIcon from 'lucide-svelte/icons/arrow-left';
	import PencilIcon from 'lucide-svelte/icons/pencil';
	import TrashIcon from 'lucide-svelte/icons/trash';
	import { getLocation, updateLocation, deleteLocation } from '$services/locationService';
	import { notify } from '$stores/toast';
	import type { Asset, Location } from '$lib/types';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	const locationId = $derived(params.id);

	let loading = $state(true);
	let location = $state<Location | null>(null);
	let assets = $state<Asset[]>([]);

	let editing = $state(false);
	let form = $state({ name: '', locationCode: '', description: '' });
	let saving = $state(false);
	let deleteOpen = $state(false);

	async function load() {
		loading = true;
		try {
			const result = await getLocation(locationId);
			if (!result) {
				notify.error('Location not found');
				await goto(resolve('/locations'));
				return;
			}
			location = result;
			assets = result.assets;
			form = {
				name: result.name,
				locationCode: result.location_code ?? '',
				description: result.description ?? ''
			};
		} catch (err) {
			notify.error('Failed to load location', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function saveEdits() {
		if (!location) return;
		saving = true;
		try {
			location = {
				...location,
				...(await updateLocation(location.id, {
					name: form.name.trim(),
					location_code: form.locationCode.trim() || null,
					description: form.description.trim()
				}))
			};
			editing = false;
			notify.success('Location updated');
		} catch (err) {
			notify.error('Failed to save', err instanceof Error ? err.message : undefined);
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!location) return;
		try {
			await deleteLocation(location.id);
			notify.success('Location deleted');
			await goto(resolve('/locations'));
		} catch (err) {
			notify.error('Cannot delete location', err instanceof Error ? err.message : undefined);
		}
	}
</script>

<svelte:head>
	<title>{location?.name ?? 'Location'} — LF Inventory</title>
</svelte:head>

<div class="space-y-4">
	<button
		type="button"
		onclick={() => goto(resolve('/locations'))}
		class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-3.5" />
		Back to Locations
	</button>

	{#if loading}
		<LoadingSkeleton rows={6} cols={3} />
	{:else if location}
		<div class="rounded-lg border border-border p-4">
			{#if editing}
				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1.5">
							<Label for="loc-name">Name</Label>
							<Input id="loc-name" bind:value={form.name} />
						</div>
						<div class="space-y-1.5">
							<Label for="loc-code">Code</Label>
							<Input id="loc-code" bind:value={form.locationCode} />
						</div>
					</div>
					<div class="space-y-1.5">
						<Label for="loc-description">Description</Label>
						<Textarea id="loc-description" bind:value={form.description} rows={2} />
					</div>
					<div class="flex justify-end gap-2">
						<Button variant="outline" onclick={() => (editing = false)} disabled={saving}
							>Cancel</Button
						>
						<Button onclick={saveEdits} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
					</div>
				</div>
			{:else}
				<div class="flex items-start justify-between">
					<div>
						<div class="flex items-center gap-2">
							<h1 class="text-lg font-semibold tracking-tight">{location.name}</h1>
							{#if location.location_code}
								<span class="font-mono-lfc text-xs text-muted-foreground"
									>{location.location_code}</span
								>
							{/if}
						</div>
						<p class="mt-1 text-sm text-muted-foreground">
							{location.description ?? 'No description'}
						</p>
					</div>
					<div class="flex gap-2">
						<Button variant="outline" size="sm" onclick={() => (editing = true)}>
							<PencilIcon class="size-4" />
							Edit
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={assets.length > 0}
							onclick={() => (deleteOpen = true)}
						>
							<TrashIcon class="size-4" />
							Delete
						</Button>
					</div>
				</div>
			{/if}
		</div>

		<div class="rounded-lg border border-border bg-card">
			<AssetTable {assets} />
		</div>
	{/if}
</div>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete this location?"
	description="This can't be undone."
	confirmLabel="Delete"
	destructive
	onConfirm={handleDelete}
/>
