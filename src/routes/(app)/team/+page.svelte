<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import * as Select from '$components/ui/select';
	import * as Dialog from '$components/ui/dialog';
	import * as Table from '$components/ui/table';
	import { Badge } from '$components/ui/badge';
	import ConfirmDialog from '$components/shared/ConfirmDialog.svelte';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import EmptyState from '$components/shared/EmptyState.svelte';
	import PlusIcon from 'lucide-svelte/icons/plus';
	import PencilIcon from 'lucide-svelte/icons/pencil';
	import TrashIcon from 'lucide-svelte/icons/trash';
	import UsersIcon from 'lucide-svelte/icons/users';
	import LinkIcon from 'lucide-svelte/icons/link';
	import UnlinkIcon from 'lucide-svelte/icons/unlink';
	import BadgeCheckIcon from 'lucide-svelte/icons/badge-check';
	import {
		getTeamMembers,
		createTeamMember,
		updateTeamMember,
		deleteTeamMember,
		getAssetsCheckedOutCount
	} from '$services/teamService';
	import { notify } from '$stores/toast';
	import { currentUser } from '$stores/auth';
	import { formatDate } from '$lib/utils';
	import type { TeamMember, TeamMemberRole } from '$lib/types';

	const roles: TeamMemberRole[] = ['Admin', 'Member'];

	const isAdmin = $derived($currentUser?.employeeRole === 'Admin');

	let loading = $state(true);
	let members = $state<TeamMember[]>([]);
	let checkedOutCounts = $state<Record<string, number>>({});

	let dialogOpen = $state(false);
	let editingId = $state<string | null>(null);
	let form = $state({ name: '', pin: '', password: '', role: 'Member' as TeamMemberRole });
	let submitting = $state(false);
	let deleteTarget = $state<TeamMember | null>(null);
	let deleteOpen = $state(false);

	let linkDialogOpen = $state(false);
	let linkTarget = $state<TeamMember | null>(null);
	let linkEmail = $state('');
	let linkSubmitting = $state(false);
	let linkError = $state('');
	let unlinkSubmitting = $state<string | null>(null);

	async function load() {
		loading = true;
		try {
			members = await getTeamMembers();
			const counts: Record<string, number> = {};
			await Promise.all(
				members.map(async (member) => {
					counts[member.id] = await getAssetsCheckedOutCount(member.id);
				})
			);
			checkedOutCounts = counts;
		} catch (err) {
			notify.error('Failed to load team members', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function openCreate() {
		editingId = null;
		form = { name: '', pin: '', password: '', role: 'Member' };
		dialogOpen = true;
	}

	function openEdit(member: TeamMember) {
		editingId = member.id;
		form = {
			name: member.name,
			pin: member.pin,
			password: member.password ?? '',
			role: member.role
		};
		dialogOpen = true;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!form.name.trim() || !form.pin.trim() || !form.password.trim()) return;

		submitting = true;
		try {
			if (editingId) {
				const updated = await updateTeamMember(editingId, form);
				members = members.map((m) => (m.id === editingId ? updated : m));
				notify.success('Team member updated');
			} else {
				const created = await createTeamMember(form);
				members = [...members, created];
				checkedOutCounts[created.id] = 0;
				notify.success('Team member added');
			}
			dialogOpen = false;
		} catch (err) {
			notify.error('Failed to save', err instanceof Error ? err.message : undefined);
		} finally {
			submitting = false;
		}
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		try {
			await deleteTeamMember(deleteTarget.id);
			members = members.filter((m) => m.id !== deleteTarget?.id);
			notify.success('Team member removed');
		} catch (err) {
			notify.error('Cannot delete team member', err instanceof Error ? err.message : undefined);
		}
	}

	function openLinkDialog(member: TeamMember) {
		linkTarget = member;
		linkEmail = '';
		linkError = '';
		linkDialogOpen = true;
	}
</script>

<svelte:head>
	<title>Team — LF Inventory</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-lg font-semibold tracking-tight">Team</h1>
		<Button onclick={openCreate}>
			<PlusIcon class="size-4" />
			Add Member
		</Button>
	</div>

	<div class="rounded-lg border border-border bg-card">
		{#if loading}
			<div class="p-4"><LoadingSkeleton rows={5} cols={6} /></div>
		{:else if members.length === 0}
			<EmptyState icon={UsersIcon} title="No team members yet" />
		{:else}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>PIN</Table.Head>
						<Table.Head>Role</Table.Head>
						<Table.Head>Member Since</Table.Head>
						<Table.Head>Checked Out</Table.Head>
						<Table.Head></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each members as member (member.id)}
						<Table.Row>
							<Table.Cell class="font-medium">
								<div class="flex items-center gap-2">
									{member.name}
									{#if member.supabase_auth_id}
										<Badge
											variant="outline"
											class="gap-1 border-lfc-available/40 text-lfc-available"
										>
											<BadgeCheckIcon class="size-3" />
											Linked
										</Badge>
									{/if}
								</div>
							</Table.Cell>
							<Table.Cell class="font-mono-lfc">{member.pin}</Table.Cell>
							<Table.Cell><Badge variant="outline">{member.role}</Badge></Table.Cell>
							<Table.Cell class="text-muted-foreground">
								{formatDate(member.created_at)}
							</Table.Cell>
							<Table.Cell>{checkedOutCounts[member.id] ?? 0}</Table.Cell>
							<Table.Cell>
								<div class="flex justify-end gap-1">
									{#if isAdmin}
										{#if member.supabase_auth_id}
											<form
												method="POST"
												action="?/unlinkAccount"
												use:enhance={() => {
													unlinkSubmitting = member.id;
													return async ({ result, update }) => {
														unlinkSubmitting = null;
														if (result.type === 'success') {
															members = members.map((m) =>
																m.id === member.id ? { ...m, supabase_auth_id: null } : m
															);
															notify.success('Account unlinked');
														} else if (result.type === 'failure') {
															notify.error(
																(result.data?.linkError as string) ?? 'Failed to unlink account'
															);
														}
														await update({ reset: false });
													};
												}}
											>
												<input type="hidden" name="memberId" value={member.id} />
												<Button
													type="submit"
													variant="ghost"
													size="icon"
													disabled={unlinkSubmitting === member.id}
													title="Unlink auth account"
												>
													<UnlinkIcon class="size-4" />
												</Button>
											</form>
										{:else}
											<Button
												variant="ghost"
												size="icon"
												onclick={() => openLinkDialog(member)}
												title="Link auth account"
											>
												<LinkIcon class="size-4" />
											</Button>
										{/if}
									{/if}
									<Button variant="ghost" size="icon" onclick={() => openEdit(member)}>
										<PencilIcon class="size-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										disabled={(checkedOutCounts[member.id] ?? 0) > 0}
										onclick={() => {
											deleteTarget = member;
											deleteOpen = true;
										}}
									>
										<TrashIcon class="size-4" />
									</Button>
								</div>
							</Table.Cell>
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
			<Dialog.Title>{editingId ? 'Edit Member' : 'Add Member'}</Dialog.Title>
		</Dialog.Header>
		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="space-y-1.5">
				<Label for="member-name">Name</Label>
				<Input id="member-name" bind:value={form.name} required />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="member-pin">PIN</Label>
					<Input id="member-pin" bind:value={form.pin} maxlength={4} inputmode="numeric" required />
				</div>
				<div class="space-y-1.5">
					<Label for="member-password">Password</Label>
					<Input id="member-password" type="password" bind:value={form.password} required />
				</div>
			</div>
			<div class="space-y-1.5">
				<Label>Role</Label>
				<Select.Root type="single" bind:value={form.role}>
					<Select.Trigger class="w-full capitalize">{form.role}</Select.Trigger>
					<Select.Content>
						{#each roles as role (role)}
							<Select.Item value={role} label={role} />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={linkDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Link Auth Account</Dialog.Title>
			<Dialog.Description>
				Link {linkTarget?.name}'s record to their Google/Microsoft account by email.
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/linkAccount"
			use:enhance={() => {
				linkSubmitting = true;
				linkError = '';
				return async ({ result, update }) => {
					linkSubmitting = false;
					if (result.type === 'success') {
						const authUserId = result.data?.authUserId as string | undefined;
						if (linkTarget && authUserId) {
							const linkedId = linkTarget.id;
							members = members.map((m) =>
								m.id === linkedId ? { ...m, supabase_auth_id: authUserId } : m
							);
						}
						notify.success('Account linked');
						linkDialogOpen = false;
					} else if (result.type === 'failure') {
						linkError = (result.data?.linkError as string) ?? 'Failed to link account';
					}
					await update({ reset: false });
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="memberId" value={linkTarget?.id ?? ''} />
			<div class="space-y-1.5">
				<Label for="link-email">Employee's email address</Label>
				<Input
					id="link-email"
					name="email"
					type="email"
					bind:value={linkEmail}
					placeholder="employee@lfcrea.com"
					required
				/>
				{#if linkError}
					<p class="text-xs text-destructive">{linkError}</p>
				{/if}
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (linkDialogOpen = false)}
					>Cancel</Button
				>
				<Button type="submit" disabled={linkSubmitting}>
					{linkSubmitting ? 'Linking…' : 'Link Account'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Remove this team member?"
	description="This can't be undone."
	confirmLabel="Remove"
	destructive
	onConfirm={handleDelete}
/>
