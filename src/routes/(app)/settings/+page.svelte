<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import PlusIcon from 'lucide-svelte/icons/plus';
	import XIcon from 'lucide-svelte/icons/x';
	import DownloadIcon from 'lucide-svelte/icons/download';
	import SunIcon from 'lucide-svelte/icons/sun';
	import MoonIcon from 'lucide-svelte/icons/moon';
	import { currentUser } from '$stores/auth';
	import { theme } from '$stores/theme';
	import { cn } from '$lib/utils';
	import { updateTeamMember, getTeamMembers } from '$services/teamService';
	import { getLocations, createLocation } from '$services/locationService';
	import { getAssets } from '$services/assetService';
	import { getContainers } from '$services/containerService';
	import { notify } from '$stores/toast';
	import { authenticateEmployee } from '$lib/auth';
	import type { Location } from '$lib/types';

	const isAdmin = $derived($currentUser?.employeeRole === 'Admin');

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let changingPassword = $state(false);

	const DEFAULT_ASSET_TYPES = ['Camera', 'Lens', 'Lighting', 'Audio', 'Grip', 'Cable', 'Case'];
	let assetTypes = $state<string[]>(DEFAULT_ASSET_TYPES);
	let newAssetType = $state('');

	let locations = $state<Location[]>([]);
	let newLocationName = $state('');
	let newLocationCode = $state('');

	let systemInfo = $state({
		totalAssets: 0,
		totalContainers: 0,
		lastSync: new Date().toISOString()
	});

	onMount(async () => {
		if (!isAdmin) return;
		try {
			const [assets, containers, locs] = await Promise.all([
				getAssets(),
				getContainers(),
				getLocations()
			]);
			systemInfo = {
				totalAssets: assets.length,
				totalContainers: containers.length,
				lastSync: new Date().toISOString()
			};
			locations = locs;

			const storedTypes = localStorage.getItem('lf_asset_types');
			if (storedTypes) assetTypes = JSON.parse(storedTypes);
		} catch {
			// non-fatal
		}
	});

	function persistAssetTypes() {
		localStorage.setItem('lf_asset_types', JSON.stringify(assetTypes));
	}

	function addAssetType() {
		const trimmed = newAssetType.trim();
		if (!trimmed || assetTypes.includes(trimmed)) return;
		assetTypes = [...assetTypes, trimmed];
		newAssetType = '';
		persistAssetTypes();
	}

	function removeAssetType(type: string) {
		assetTypes = assetTypes.filter((t) => t !== type);
		persistAssetTypes();
	}

	async function addLocation() {
		if (!newLocationName.trim() || !newLocationCode.trim()) return;
		try {
			const location = await createLocation({
				name: newLocationName.trim(),
				location_code: newLocationCode.trim() || undefined
			});
			locations = [...locations, location];
			newLocationName = '';
			newLocationCode = '';
			notify.success('Location added');
		} catch (err) {
			notify.error('Failed to add location', err instanceof Error ? err.message : undefined);
		}
	}

	async function handlePasswordChange(event: SubmitEvent) {
		event.preventDefault();
		if (!$currentUser) return;
		if (newPassword !== confirmPassword) {
			notify.error('New passwords do not match');
			return;
		}
		if (!newPassword) {
			notify.error('Enter a new password');
			return;
		}

		changingPassword = true;
		try {
			const member = await authenticateEmployee($currentUser.employeeId, currentPassword);
			if (!member) {
				notify.error('Current password is incorrect');
				return;
			}
			await updateTeamMember(member.id, { password: newPassword });
			notify.success('Password updated');
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch (err) {
			notify.error('Failed to update password', err instanceof Error ? err.message : undefined);
		} finally {
			changingPassword = false;
		}
	}

	async function exportAllData() {
		try {
			const [assets, containers, locs, members] = await Promise.all([
				getAssets(),
				getContainers(),
				getLocations(),
				getTeamMembers()
			]);

			const datasets: [string, Record<string, unknown>[]][] = [
				['assets', assets as unknown as Record<string, unknown>[]],
				['containers', containers as unknown as Record<string, unknown>[]],
				['locations', locs as unknown as Record<string, unknown>[]],
				['team_members', members as unknown as Record<string, unknown>[]]
			];

			for (const [name, rows] of datasets) {
				if (rows.length === 0) continue;
				const header = Object.keys(rows[0]);
				const csv = [
					header.join(','),
					...rows.map((row) =>
						header.map((key) => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(',')
					)
				].join('\n');
				const blob = new Blob([csv], { type: 'text/csv' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${name}.csv`;
				a.click();
				URL.revokeObjectURL(url);
			}
			notify.success('Export started', 'Each table downloads as a separate CSV file');
		} catch (err) {
			notify.error('Export failed', err instanceof Error ? err.message : undefined);
		}
	}
</script>

<svelte:head>
	<title>Settings — Asset Manager</title>
</svelte:head>

<div class="max-w-2xl space-y-6">
	<h1 class="text-lg font-semibold tracking-tight">Settings</h1>

	<Card>
		<CardHeader>
			<CardTitle>Appearance</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium">Theme</p>
					<p class="text-xs text-muted-foreground">
						Saved to your account — separate from the lf-scan app's theme.
					</p>
				</div>
				<div class="flex gap-1 rounded-lg border border-border p-1">
					<button
						type="button"
						onclick={() => theme.apply('light')}
						class={cn(
							'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
							$theme === 'light'
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						<SunIcon class="size-4" />
						Light
					</button>
					<button
						type="button"
						onclick={() => theme.apply('dark')}
						class={cn(
							'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
							$theme === 'dark'
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						<MoonIcon class="size-4" />
						Dark
					</button>
				</div>
			</div>
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle>Personal</CardTitle>
		</CardHeader>
		<CardContent>
			<form onsubmit={handlePasswordChange} class="space-y-3">
				<div class="space-y-1.5">
					<Label for="current-password">Current Password</Label>
					<Input id="current-password" type="password" bind:value={currentPassword} required />
				</div>
				<div class="space-y-1.5">
					<Label for="new-password">New Password</Label>
					<Input id="new-password" type="password" bind:value={newPassword} required />
				</div>
				<div class="space-y-1.5">
					<Label for="confirm-password">Confirm New Password</Label>
					<Input id="confirm-password" type="password" bind:value={confirmPassword} required />
				</div>
				<Button type="submit" disabled={changingPassword}>
					{changingPassword ? 'Updating…' : 'Change Password'}
				</Button>
			</form>
		</CardContent>
	</Card>

	{#if isAdmin}
		<Card>
			<CardHeader>
				<CardTitle>Asset Types</CardTitle>
			</CardHeader>
			<CardContent class="space-y-3">
				<div class="flex flex-wrap gap-2">
					{#each assetTypes as type (type)}
						<Badge variant="outline" class="gap-1">
							{type}
							<button type="button" onclick={() => removeAssetType(type)}>
								<XIcon class="size-3" />
							</button>
						</Badge>
					{/each}
				</div>
				<div class="flex gap-2">
					<Input bind:value={newAssetType} placeholder="New type…" class="max-w-xs" />
					<Button variant="outline" onclick={addAssetType}>
						<PlusIcon class="size-4" />
						Add
					</Button>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle>Locations</CardTitle>
			</CardHeader>
			<CardContent class="space-y-3">
				<ul class="divide-y divide-border">
					{#each locations as location (location.id)}
						<li class="flex items-center justify-between py-2 text-sm">
							<span>{location.name}</span>
							{#if location.location_code}
								<span class="font-mono-lfc text-xs text-muted-foreground"
									>{location.location_code}</span
								>
							{/if}
						</li>
					{/each}
				</ul>
				<div class="flex gap-2">
					<Input bind:value={newLocationName} placeholder="Name" class="max-w-40" />
					<Input bind:value={newLocationCode} placeholder="Code" class="max-w-28" />
					<Button variant="outline" onclick={addLocation}>
						<PlusIcon class="size-4" />
						Add
					</Button>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle>System Info</CardTitle>
			</CardHeader>
			<CardContent class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-muted-foreground">Total Assets</span>
					<span>{systemInfo.totalAssets}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Total Containers</span>
					<span>{systemInfo.totalContainers}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Last Sync</span>
					<span>{new Date(systemInfo.lastSync).toLocaleString()}</span>
				</div>
				<Button variant="outline" class="mt-2 w-full" onclick={exportAllData}>
					<DownloadIcon class="size-4" />
					Export All Data
				</Button>
			</CardContent>
		</Card>
	{/if}
</div>
