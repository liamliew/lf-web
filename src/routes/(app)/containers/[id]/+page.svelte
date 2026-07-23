<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Button } from '$components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Separator } from '$components/ui/separator';
	import * as Select from '$components/ui/select';
	import * as Dialog from '$components/ui/dialog';
	import StatusBadge from '$components/shared/StatusBadge.svelte';
	import AssetCard from '$components/assets/AssetCard.svelte';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import ArrowLeftIcon from 'lucide-svelte/icons/arrow-left';
	import PlusIcon from 'lucide-svelte/icons/plus';
	import MinusIcon from 'lucide-svelte/icons/minus';
	import Trash2Icon from 'lucide-svelte/icons/trash-2';
	import {
		getContainer,
		getContainerEvents,
		addAssetToContainer,
		removeAssetFromContainer,
		clearContainer,
		commitContainerOperation
	} from '$services/containerService';
	import { getAssets } from '$services/assetService';
	import { getLocations } from '$services/locationService';
	import { notify } from '$stores/toast';
	import { currentUser } from '$stores/auth';
	import { formatDate } from '$lib/utils';
	import type { Asset, Container, ContainerEvent, Location } from '$lib/types';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	const containerId = $derived(params.id);

	let loading = $state(true);
	let container = $state<Container | null>(null);
	let assets = $state<Asset[]>([]);
	let locations = $state<Location[]>([]);
	let events = $state<ContainerEvent[]>([]);

	let addDialogOpen = $state(false);
	let availableAssets = $state<Asset[]>([]);
	let assetToAdd = $state<string | undefined>(undefined);

	let clearDialogOpen = $state(false);
	let clearing = $state(false);

	let checkModalOpen = $state(false);
	let checkMode = $state<'check_in' | 'check_out'>('check_in');
	let checkLocationId = $state<string | undefined>(undefined);

	async function load() {
		loading = true;
		try {
			const result = await getContainer(containerId);
			if (!result) {
				notify.error('Container not found');
				await goto(resolve('/containers'));
				return;
			}
			container = result;
			assets = result.assets;
			locations = await getLocations().catch(() => []);
			events = await getContainerEvents(containerId).catch(() => []);
		} catch (err) {
			notify.error('Failed to load container', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function openAddDialog() {
		addDialogOpen = true;
		availableAssets = (await getAssets({ status: 'available' })).filter((a) => !a.container_id);
	}

	async function handleAdd() {
		if (!assetToAdd || !$currentUser || !container) return;
		await addAssetToContainer(
			assetToAdd,
			container.id,
			$currentUser.employeeId,
			$currentUser.employeeName
		);
		await load();
		addDialogOpen = false;
		assetToAdd = undefined;
		notify.success('Asset added to container');
	}

	async function handleRemove(assetId: string) {
		if (!$currentUser || !container) return;
		await removeAssetFromContainer(
			assetId,
			container.id,
			$currentUser.employeeId,
			false,
			$currentUser.employeeName
		);
		await load();
		notify.success('Asset removed from container');
	}

	async function handleClearContainer() {
		if (!$currentUser || !container) return;
		clearing = true;
		try {
			await clearContainer(container.id, $currentUser.employeeId, $currentUser.employeeName);
			await load();
			clearDialogOpen = false;
			notify.success('All assets removed from container');
		} catch (err) {
			notify.error('Failed to clear container', err instanceof Error ? err.message : undefined);
		} finally {
			clearing = false;
		}
	}

	function openCheckModal(mode: 'check_in' | 'check_out') {
		checkMode = mode;
		checkLocationId = container?.current_location_id ?? undefined;
		checkModalOpen = true;
	}

	async function confirmCheck() {
		if (!container || !$currentUser) return;
		container = await commitContainerOperation(
			container.id,
			checkMode,
			checkLocationId ?? container.current_location_id,
			$currentUser.employeeId,
			$currentUser.employeeName
		);
		checkModalOpen = false;
		notify.success(checkMode === 'check_in' ? 'Checked in' : 'Checked out');
	}

	const selectedAssetLabel = $derived(
		availableAssets.find((a) => a.asset_id === assetToAdd)?.name ?? 'Select asset'
	);
	const selectedCheckLocationLabel = $derived(
		locations.find((l) => l.id === checkLocationId)?.name ?? 'Select location'
	);
</script>

<svelte:head>
	<title>{container?.name ?? 'Container'} — LF Inventory</title>
</svelte:head>

<div class="space-y-4">
	<button
		type="button"
		onclick={() => goto(resolve('/containers'))}
		class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="size-3.5" />
		Back to Containers
	</button>

	{#if loading}
		<LoadingSkeleton rows={6} cols={3} />
	{:else if container}
		<div
			class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
		>
			<div class="space-y-1">
				<h1 class="text-lg font-semibold tracking-tight">{container.name}</h1>
				<div class="flex items-center gap-2">
					<StatusBadge status={container.status} />
					<span class="font-mono-lfc text-xs text-muted-foreground">{container.container_id}</span>
				</div>
			</div>
			<div class="flex gap-2">
				{#if container.status === 'available'}
					<Button onclick={() => openCheckModal('check_out')}>Check Out</Button>
				{:else}
					<Button onclick={() => openCheckModal('check_in')}>Check In</Button>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div class="space-y-3 lg:col-span-2">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold">Assets in this container ({assets.length})</h2>
					<div class="flex items-center gap-2">
						<Button variant="outline" size="sm" onclick={openAddDialog}>
							<PlusIcon class="size-4" />
							Add Asset
						</Button>
						<Button
							variant="destructive"
							size="sm"
							disabled={assets.length === 0}
							onclick={() => (clearDialogOpen = true)}
						>
							<Trash2Icon class="size-4" />
							Clear Container
						</Button>
					</div>
				</div>

				{#if assets.length === 0}
					<p
						class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
					>
						No assets in this container yet.
					</p>
				{:else}
					<div class="space-y-2">
						{#each assets as asset (asset.asset_id)}
							<AssetCard {asset}>
								{#snippet actions()}
									<Button variant="ghost" size="icon" onclick={() => handleRemove(asset.asset_id)}>
										<MinusIcon class="size-4" />
									</Button>
								{/snippet}
							</AssetCard>
						{/each}
					</div>
				{/if}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Activity</CardTitle>
				</CardHeader>
				<CardContent>
					{#if events.length === 0}
						<p class="text-sm text-muted-foreground">No activity yet.</p>
					{:else}
						<ol class="space-y-4">
							{#each events as event (event.id)}
								<li class="space-y-0.5 text-sm">
									<p class="font-medium capitalize">{event.event_type.replace(/_/g, ' ')}</p>
									<p class="text-xs text-muted-foreground">
										{event.performed_by_name} · {formatDate(event.created_at)}
									</p>
									{#if event.notes}
										<p class="text-xs text-muted-foreground">{event.notes}</p>
									{/if}
								</li>
								{#if event !== events[events.length - 1]}
									<Separator />
								{/if}
							{/each}
						</ol>
					{/if}
				</CardContent>
			</Card>
		</div>
	{/if}
</div>

<Dialog.Root bind:open={addDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add Asset to Container</Dialog.Title>
		</Dialog.Header>
		<Select.Root type="single" bind:value={assetToAdd}>
			<Select.Trigger class="w-full">{selectedAssetLabel}</Select.Trigger>
			<Select.Content>
				{#each availableAssets as asset (asset.asset_id)}
					<Select.Item value={asset.asset_id} label={asset.name} />
				{/each}
			</Select.Content>
		</Select.Root>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (addDialogOpen = false)}>Cancel</Button>
			<Button onclick={handleAdd} disabled={!assetToAdd}>Add</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={checkModalOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{checkMode === 'check_in' ? 'Check In' : 'Check Out'} Container</Dialog.Title>
		</Dialog.Header>
		<Select.Root type="single" bind:value={checkLocationId}>
			<Select.Trigger class="w-full">{selectedCheckLocationLabel}</Select.Trigger>
			<Select.Content>
				{#each locations as location (location.id)}
					<Select.Item value={location.id} label={location.name} />
				{/each}
			</Select.Content>
		</Select.Root>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (checkModalOpen = false)}>Cancel</Button>
			<Button onclick={confirmCheck}>Confirm</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={clearDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Clear Container?</Dialog.Title>
			<Dialog.Description class="pt-2 text-sm text-muted-foreground">
				Are you sure you want to remove all {assets.length}
				{assets.length === 1 ? 'asset' : 'assets'} from
				<span class="font-medium text-foreground">{container?.name}</span>? This will unassign them
				from this container.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="mt-4">
			<Button variant="outline" onclick={() => (clearDialogOpen = false)}>Cancel</Button>
			<Button variant="destructive" onclick={handleClearContainer} disabled={clearing}>
				{clearing ? 'Clearing…' : 'Clear Container'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
