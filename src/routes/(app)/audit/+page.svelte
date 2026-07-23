<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import * as Select from '$components/ui/select';
	import * as Dialog from '$components/ui/dialog';
	import EmptyState from '$components/shared/EmptyState.svelte';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import PlusIcon from 'lucide-svelte/icons/plus';
	import ClipboardCheckIcon from 'lucide-svelte/icons/clipboard-check';
	import { getAudits, createAudit } from '$services/auditService';
	import { getLocations } from '$services/locationService';
	import { notify } from '$stores/toast';
	import { currentUser } from '$stores/auth';
	import { formatDate } from '$lib/utils';
	import type { Audit, Location } from '$lib/types';

	let loading = $state(true);
	let audits = $state<Audit[]>([]);
	let locations = $state<Location[]>([]);

	let dialogOpen = $state(false);
	let locationId = $state<string | undefined>(undefined);
	let submitting = $state(false);

	const active = $derived(audits.filter((a) => a.status === 'in_progress'));
	const completed = $derived(audits.filter((a) => a.status !== 'in_progress'));
	const selectedLocationLabel = $derived(
		locations.find((l) => l.id === locationId)?.name ?? 'Select location'
	);

	async function load() {
		loading = true;
		try {
			[audits, locations] = await Promise.all([getAudits(), getLocations()]);
		} catch (err) {
			notify.error('Failed to load audits', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function handleCreate() {
		if (!locationId || !$currentUser) return;
		submitting = true;
		try {
			const audit = await createAudit(
				locationId,
				$currentUser.employeeId,
				$currentUser.employeeName
			);
			dialogOpen = false;
			await goto(resolve('/(app)/audit/[id]', { id: audit.id }));
		} catch (err) {
			notify.error('Failed to start audit', err instanceof Error ? err.message : undefined);
		} finally {
			submitting = false;
		}
	}

	function progress(audit: Audit): number {
		if (audit.total_expected === 0) return 0;
		return Math.round((audit.total_matched / audit.total_expected) * 100);
	}
</script>

<svelte:head>
	<title>Audit — Asset Manager</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-lg font-semibold tracking-tight">Audit</h1>
		<Button onclick={() => (dialogOpen = true)}>
			<PlusIcon class="size-4" />
			New Audit
		</Button>
	</div>

	{#if loading}
		<LoadingSkeleton rows={4} cols={3} />
	{:else}
		<div class="space-y-3">
			<h2 class="text-sm font-semibold text-muted-foreground">In Progress</h2>
			{#if active.length === 0}
				<p class="text-sm text-muted-foreground">No audits currently in progress.</p>
			{:else}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each active as audit (audit.id)}
						<button
							type="button"
							class="text-left"
							onclick={() => goto(resolve('/(app)/audit/[id]', { id: audit.id }))}
						>
							<Card class="h-full transition-colors hover:border-primary/50">
								<CardHeader>
									<CardTitle class="text-base">{audit.location_name}</CardTitle>
								</CardHeader>
								<CardContent class="space-y-2">
									<p class="text-xs text-muted-foreground">
										Started {formatDate(audit.started_at)}
									</p>
									<div class="h-1.5 w-full rounded-full bg-muted">
										<div
											class="h-1.5 rounded-full bg-primary"
											style={`width: ${progress(audit)}%`}
										></div>
									</div>
									<div class="flex justify-between text-xs text-muted-foreground">
										<span>{audit.total_matched} matched</span>
										<span>{audit.total_missing} missing</span>
										<span>{audit.total_unexpected} unexpected</span>
									</div>
								</CardContent>
							</Card>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="space-y-3">
			<h2 class="text-sm font-semibold text-muted-foreground">Completed</h2>
			{#if completed.length === 0}
				<EmptyState icon={ClipboardCheckIcon} title="No completed audits yet" />
			{:else}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each completed as audit (audit.id)}
						<button
							type="button"
							class="text-left"
							onclick={() => goto(resolve('/(app)/audit/[id]/results', { id: audit.id }))}
						>
							<Card class="h-full transition-colors hover:border-primary/50">
								<CardHeader>
									<CardTitle class="text-base">{audit.location_name}</CardTitle>
								</CardHeader>
								<CardContent class="space-y-1">
									<p class="text-xs text-muted-foreground">
										Completed {audit.completed_at ? formatDate(audit.completed_at) : '—'}
									</p>
									<div class="flex justify-between text-xs text-muted-foreground">
										<span>{audit.total_matched} matched</span>
										<span>{audit.total_missing} missing</span>
										<span>{audit.total_unexpected} unexpected</span>
									</div>
								</CardContent>
							</Card>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Start New Audit</Dialog.Title>
			<Dialog.Description>Select the location to audit.</Dialog.Description>
		</Dialog.Header>
		<Select.Root type="single" bind:value={locationId}>
			<Select.Trigger class="w-full">{selectedLocationLabel}</Select.Trigger>
			<Select.Content>
				{#each locations as location (location.id)}
					<Select.Item value={location.id} label={location.name} />
				{/each}
			</Select.Content>
		</Select.Root>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (dialogOpen = false)}>Cancel</Button>
			<Button onclick={handleCreate} disabled={!locationId || submitting}>
				{submitting ? 'Starting…' : 'Start Audit'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
