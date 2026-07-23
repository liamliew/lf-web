<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Textarea } from '$components/ui/textarea';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import * as Dialog from '$components/ui/dialog';
	import EmptyState from '$components/shared/EmptyState.svelte';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import PlusIcon from 'lucide-svelte/icons/plus';
	import MapPinIcon from 'lucide-svelte/icons/map-pin';
	import { getLocations, createLocation } from '$services/locationService';
	import { getAssets } from '$services/assetService';
	import { notify } from '$stores/toast';
	import type { Location } from '$lib/types';

	let loading = $state(true);
	let locations = $state<Location[]>([]);
	let assetCounts = $state<Record<string, number>>({});

	let dialogOpen = $state(false);
	let name = $state('');
	let locationCode = $state('');
	let description = $state('');
	let submitting = $state(false);

	async function load() {
		loading = true;
		try {
			locations = await getLocations();
			const assets = await getAssets();
			const counts: Record<string, number> = {};
			for (const asset of assets) {
				if (asset.current_location_id) {
					counts[asset.current_location_id] = (counts[asset.current_location_id] ?? 0) + 1;
				}
			}
			assetCounts = counts;
		} catch (err) {
			notify.error('Failed to load locations', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function handleCreate(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) return;
		submitting = true;
		try {
			const location = await createLocation({
				name: name.trim(),
				location_code: locationCode.trim() || undefined,
				description: description.trim() || undefined
			});
			locations = [...locations, location];
			notify.success('Location created');
			name = '';
			locationCode = '';
			description = '';
			dialogOpen = false;
		} catch (err) {
			notify.error('Failed to create location', err instanceof Error ? err.message : undefined);
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Locations — Asset Manager</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-lg font-semibold tracking-tight">Locations</h1>
		<Button onclick={() => (dialogOpen = true)}>
			<PlusIcon class="size-4" />
			Add Location
		</Button>
	</div>

	{#if loading}
		<LoadingSkeleton rows={4} cols={3} />
	{:else if locations.length === 0}
		<EmptyState
			icon={MapPinIcon}
			title="No locations yet"
			description="Add your first location to start assigning assets."
		/>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each locations as location (location.id)}
				<button
					type="button"
					class="text-left"
					onclick={() => goto(resolve('/(app)/locations/[id]', { id: location.id }))}
				>
					<Card class="h-full transition-colors hover:border-primary/50">
						<CardHeader>
							<div class="flex items-center justify-between">
								<CardTitle class="text-base">{location.name}</CardTitle>
								{#if location.location_code}
									<span class="font-mono-lfc text-xs text-muted-foreground"
										>{location.location_code}</span
									>
								{/if}
							</div>
						</CardHeader>
						<CardContent class="space-y-2">
							<p class="text-sm text-muted-foreground">
								{location.description ?? 'No description'}
							</p>
							<p class="text-sm font-medium">{assetCounts[location.id] ?? 0} assets</p>
						</CardContent>
					</Card>
				</button>
			{/each}
		</div>
	{/if}
</div>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add Location</Dialog.Title>
		</Dialog.Header>
		<form onsubmit={handleCreate} class="space-y-4">
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="loc-name">Name</Label>
					<Input id="loc-name" bind:value={name} placeholder="Main Warehouse" required />
				</div>
				<div class="space-y-1.5">
					<Label for="loc-code">Code</Label>
					<Input id="loc-code" bind:value={locationCode} placeholder="WH-01" />
				</div>
			</div>
			<div class="space-y-1.5">
				<Label for="loc-description">Description</Label>
				<Textarea id="loc-description" bind:value={description} rows={3} />
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
