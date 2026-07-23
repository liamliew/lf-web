<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Textarea } from '$components/ui/textarea';
	import * as Select from '$components/ui/select';
	import * as Dialog from '$components/ui/dialog';
	import * as Table from '$components/ui/table';
	import StatusBadge from '$components/shared/StatusBadge.svelte';
	import EmptyState from '$components/shared/EmptyState.svelte';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import PlusIcon from 'lucide-svelte/icons/plus';
	import ArchiveIcon from 'lucide-svelte/icons/archive';
	import { getContainers, createContainer } from '$services/containerService';
	import { getAssets } from '$services/assetService';
	import { getLocations } from '$services/locationService';
	import { notify } from '$stores/toast';
	import type { Container, Location } from '$lib/types';

	let loading = $state(true);
	let containers = $state<Container[]>([]);
	let locations = $state<Location[]>([]);
	let assetCounts = $state<Record<string, number>>({});

	let dialogOpen = $state(false);
	let containerCode = $state('');
	let name = $state('');
	let description = $state('');
	let locationId = $state<string | undefined>(undefined);
	let submitting = $state(false);

	const locationsById = $derived(Object.fromEntries(locations.map((l) => [l.id, l])));
	const selectedLocationLabel = $derived(
		locations.find((l) => l.id === locationId)?.name ?? 'Select location'
	);

	async function load() {
		loading = true;
		try {
			const [containerRows, locationRows, assets] = await Promise.all([
				getContainers(),
				getLocations(),
				getAssets()
			]);
			containers = containerRows;
			locations = locationRows;

			const counts: Record<string, number> = {};
			for (const asset of assets) {
				if (asset.container_id) counts[asset.container_id] = (counts[asset.container_id] ?? 0) + 1;
			}
			assetCounts = counts;
		} catch (err) {
			notify.error('Failed to load containers', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function handleCreate(event: SubmitEvent) {
		event.preventDefault();
		if (!containerCode.trim() || !name.trim()) return;
		submitting = true;
		try {
			const container = await createContainer({
				container_id: containerCode.trim(),
				name: name.trim(),
				description: description.trim() || undefined,
				current_location_id: locationId
			});
			containers = [container, ...containers];
			notify.success('Container created');
			containerCode = '';
			name = '';
			description = '';
			locationId = undefined;
			dialogOpen = false;
		} catch (err) {
			notify.error('Failed to create container', err instanceof Error ? err.message : undefined);
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Containers — Asset Manager</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-lg font-semibold tracking-tight">Containers</h1>
		<Button onclick={() => (dialogOpen = true)}>
			<PlusIcon class="size-4" />
			Add Container
		</Button>
	</div>

	<div class="rounded-lg border border-border bg-card">
		{#if loading}
			<div class="p-4"><LoadingSkeleton rows={6} cols={6} /></div>
		{:else if containers.length === 0}
			<EmptyState
				icon={ArchiveIcon}
				title="No containers yet"
				description="Create your first container to group assets together."
			/>
		{:else}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Container ID</Table.Head>
						<Table.Head>Name</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head>Asset Count</Table.Head>
						<Table.Head>Location</Table.Head>
						<Table.Head>Currently With</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each containers as container (container.id)}
						<Table.Row
							class="cursor-pointer"
							onclick={() => goto(resolve('/(app)/containers/[id]', { id: container.id }))}
						>
							<Table.Cell class="font-mono-lfc text-xs text-muted-foreground">
								{container.container_id}
							</Table.Cell>
							<Table.Cell class="font-medium">{container.name}</Table.Cell>
							<Table.Cell><StatusBadge status={container.status} /></Table.Cell>
							<Table.Cell>{assetCounts[container.id] ?? 0}</Table.Cell>
							<Table.Cell>
								{container.current_location_id
									? (locationsById[container.current_location_id]?.name ?? '—')
									: '—'}
							</Table.Cell>
							<Table.Cell>{container.current_user_name ?? '—'}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{/if}
	</div>
</div>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add Container</Dialog.Title>
		</Dialog.Header>
		<form onsubmit={handleCreate} class="space-y-4">
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="container-code">Container ID</Label>
					<Input
						id="container-code"
						bind:value={containerCode}
						placeholder="e.g. CASE-03"
						class="font-mono-lfc"
						required
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="container-name">Name</Label>
					<Input id="container-name" bind:value={name} placeholder="e.g. Road Case #3" required />
				</div>
			</div>
			<div class="space-y-1.5">
				<Label for="container-description">Description</Label>
				<Textarea id="container-description" bind:value={description} rows={2} />
			</div>
			<div class="space-y-1.5">
				<Label>Location</Label>
				<Select.Root type="single" bind:value={locationId}>
					<Select.Trigger class="w-full">{selectedLocationLabel}</Select.Trigger>
					<Select.Content>
						{#each locations as location (location.id)}
							<Select.Item value={location.id} label={location.name} />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
