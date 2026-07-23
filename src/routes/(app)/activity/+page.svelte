<script lang="ts">
	import { onMount } from 'svelte';
	import * as Table from '$components/ui/table';
	import * as Select from '$components/ui/select';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import EmptyState from '$components/shared/EmptyState.svelte';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import ChevronLeftIcon from 'lucide-svelte/icons/chevron-left';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
	import ExternalLinkIcon from 'lucide-svelte/icons/external-link';
	import ActivityIcon from 'lucide-svelte/icons/activity';
	import { getGlobalActivity, type ActivityFeedItem } from '$services/activityService';
	import { getTeamMembers } from '$services/teamService';
	import { getLocations } from '$services/locationService';
	import { notify } from '$stores/toast';
	import { formatDate } from '$lib/utils';
	import type { Location, TeamMember } from '$lib/types';

	const PAGE_SIZE = 50;

	const eventTypes = [
		'created',
		'checkout',
		'checkin',
		'location',
		'repair',
		'lost',
		'edited',
		'inquiry',
		'rented',
		'returned',
		'check_in',
		'check_out',
		'location_update',
		'asset_added',
		'asset_removed'
	];

	let loading = $state(true);
	let events = $state<ActivityFeedItem[]>([]);
	let count = $state(0);
	let page = $state(1);
	let members = $state<TeamMember[]>([]);
	let locations = $state<Location[]>([]);

	let eventType = $state<string>('all');
	let performedBy = $state<string>('all');
	let from = $state('');
	let to = $state('');

	const locationsById = $derived(Object.fromEntries(locations.map((l) => [l.id, l])));
	const membersById = $derived(Object.fromEntries(members.map((m) => [m.id, m])));
	const totalPages = $derived(Math.max(1, Math.ceil(count / PAGE_SIZE)));

	async function load() {
		loading = true;
		try {
			const result = await getGlobalActivity({
				eventType: eventType === 'all' ? undefined : eventType,
				performedBy: performedBy === 'all' ? undefined : performedBy,
				from: from || undefined,
				to: to || undefined,
				page,
				pageSize: PAGE_SIZE
			});
			events = result.events;
			count = result.count;
		} catch (err) {
			notify.error('Failed to load activity', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		[members, locations] = await Promise.all([
			getTeamMembers().catch(() => []),
			getLocations().catch(() => [])
		]);
		await load();
	});

	function applyFilters() {
		page = 1;
		load();
	}

	const eventTypeLabel = $derived(
		eventType === 'all' ? 'All events' : eventType.replace(/_/g, ' ')
	);
	const performedByLabel = $derived(
		performedBy === 'all' ? 'All employees' : (membersById[performedBy]?.name ?? 'All employees')
	);
</script>

<svelte:head>
	<title>Activity — Asset Manager</title>
</svelte:head>

<div class="space-y-4">
	<h1 class="text-lg font-semibold tracking-tight">Activity</h1>

	<div class="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
		<div class="space-y-1.5">
			<Label>Event type</Label>
			<Select.Root type="single" bind:value={eventType} onValueChange={applyFilters}>
				<Select.Trigger class="w-44 capitalize">{eventTypeLabel}</Select.Trigger>
				<Select.Content>
					<Select.Item value="all" label="All events" />
					{#each eventTypes as type (type)}
						<Select.Item value={type} label={type.replace(/_/g, ' ')} />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<div class="space-y-1.5">
			<Label>Employee</Label>
			<Select.Root type="single" bind:value={performedBy} onValueChange={applyFilters}>
				<Select.Trigger class="w-44">{performedByLabel}</Select.Trigger>
				<Select.Content>
					<Select.Item value="all" label="All employees" />
					{#each members as member (member.id)}
						<Select.Item value={member.id} label={member.name} />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<div class="space-y-1.5">
			<Label for="from-date">From</Label>
			<Input id="from-date" type="date" bind:value={from} onchange={applyFilters} class="w-40" />
		</div>
		<div class="space-y-1.5">
			<Label for="to-date">To</Label>
			<Input id="to-date" type="date" bind:value={to} onchange={applyFilters} class="w-40" />
		</div>
	</div>

	<div class="rounded-lg border border-border bg-card">
		{#if loading}
			<div class="p-4"><LoadingSkeleton rows={10} cols={6} /></div>
		{:else if events.length === 0}
			<EmptyState
				icon={ActivityIcon}
				title="No activity found"
				description="Try adjusting your filters."
			/>
		{:else}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Event</Table.Head>
						<Table.Head>Asset / Container</Table.Head>
						<Table.Head>Performed By</Table.Head>
						<Table.Head>Time</Table.Head>
						<Table.Head>Location</Table.Head>
						<Table.Head>GPS</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each events as event (event.id)}
						<Table.Row>
							<Table.Cell>
								<Badge variant="outline" class="capitalize"
									>{event.event_type.replace(/_/g, ' ')}</Badge
								>
							</Table.Cell>
							<Table.Cell class="font-mono-lfc text-xs text-muted-foreground">
								{event.asset_id ?? event.container_id ?? '—'}
							</Table.Cell>
							<Table.Cell>{event.performed_by_name ?? 'System'}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{formatDate(event.created_at)}</Table.Cell>
							<Table.Cell>
								{event.location_name ??
									(event.location_id ? (locationsById[event.location_id]?.name ?? '—') : '—')}
							</Table.Cell>
							<Table.Cell>
								{#if event.gps_lat && event.gps_lng}
									<a
										href={`https://www.openstreetmap.org/?mlat=${event.gps_lat}&mlon=${event.gps_lng}#map=16/${event.gps_lat}/${event.gps_lng}`}
										target="_blank"
										rel="noreferrer"
										class="flex items-center gap-1 text-primary hover:underline"
									>
										Map
										<ExternalLinkIcon class="size-3.5" />
									</a>
								{:else}
									—
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{/if}
	</div>

	{#if !loading && count > 0}
		<div class="flex items-center justify-between text-sm text-muted-foreground">
			<span>
				Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)} of {count}
			</span>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={page <= 1}
					onclick={() => {
						page -= 1;
						load();
					}}
				>
					<ChevronLeftIcon class="size-4" />
					Prev
				</Button>
				<span>Page {page} / {totalPages}</span>
				<Button
					variant="outline"
					size="sm"
					disabled={page >= totalPages}
					onclick={() => {
						page += 1;
						load();
					}}
				>
					Next
					<ChevronRightIcon class="size-4" />
				</Button>
			</div>
		</div>
	{/if}
</div>
