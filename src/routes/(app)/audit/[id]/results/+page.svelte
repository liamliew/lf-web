<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Button } from '$components/ui/button';
	import * as Tabs from '$components/ui/tabs';
	import LoadingSkeleton from '$components/shared/LoadingSkeleton.svelte';
	import ArrowLeftIcon from 'lucide-svelte/icons/arrow-left';
	import DownloadIcon from 'lucide-svelte/icons/download';
	import { getAudit, getAuditResults } from '$services/auditService';
	import { notify } from '$stores/toast';
	import { formatDate } from '$lib/utils';
	import type { Audit, AuditItem } from '$lib/types';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	const auditId = $derived(params.id);

	let loading = $state(true);
	let audit = $state<Audit | null>(null);
	let results = $state<{ matched: AuditItem[]; missing: AuditItem[]; unexpected: AuditItem[] }>({
		matched: [],
		missing: [],
		unexpected: []
	});

	async function load() {
		loading = true;
		try {
			const [auditResult, resultsData] = await Promise.all([
				getAudit(auditId),
				getAuditResults(auditId)
			]);
			if (!auditResult) {
				notify.error('Audit not found');
				await goto(resolve('/audit'));
				return;
			}
			audit = auditResult;
			results = resultsData;
		} catch (err) {
			notify.error('Failed to load results', err instanceof Error ? err.message : undefined);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function exportCsv() {
		const rows: string[][] = [['Result', 'Asset Code', 'Asset Name', 'Scanned At']];
		for (const [result, items] of Object.entries(results) as [string, AuditItem[]][]) {
			for (const item of items) {
				rows.push([result, item.asset_code, item.asset_name ?? '', item.scanned_at ?? '']);
			}
		}
		const csv = rows
			.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
			.join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `audit-${auditId.slice(0, 8)}-results.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function printReport() {
		window.print();
	}
</script>

<svelte:head>
	<title>Audit Results — LF Inventory</title>
</svelte:head>

<div class="space-y-4">
	<button
		type="button"
		onclick={() => goto(resolve('/audit'))}
		class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
	>
		<ArrowLeftIcon class="size-3.5" />
		Back to Audit
	</button>

	{#if loading}
		<LoadingSkeleton rows={6} cols={3} />
	{:else if audit}
		<div
			class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
		>
			<div>
				<h1 class="text-lg font-semibold tracking-tight">Audit Results — {audit.location_name}</h1>
				<p class="text-sm text-muted-foreground">
					Completed {audit.completed_at ? formatDate(audit.completed_at) : '—'}
				</p>
			</div>
			<div class="flex gap-2 print:hidden">
				<Button variant="outline" onclick={exportCsv}>
					<DownloadIcon class="size-4" />
					Export CSV
				</Button>
				<Button onclick={printReport}>Download Report</Button>
			</div>
		</div>

		<div class="grid grid-cols-3 gap-3">
			<div class="rounded-lg border border-border p-4 text-center">
				<p class="text-2xl font-semibold text-lfc-available">{results.matched.length}</p>
				<p class="text-xs text-muted-foreground">Matched</p>
			</div>
			<div class="rounded-lg border border-border p-4 text-center">
				<p class="text-2xl font-semibold text-lfc-lost">{results.missing.length}</p>
				<p class="text-xs text-muted-foreground">Missing</p>
			</div>
			<div class="rounded-lg border border-border p-4 text-center">
				<p class="text-2xl font-semibold text-lfc-checked-out">{results.unexpected.length}</p>
				<p class="text-xs text-muted-foreground">Unexpected</p>
			</div>
		</div>

		<Tabs.Root value="missing">
			<Tabs.List>
				<Tabs.Trigger value="missing">Missing ({results.missing.length})</Tabs.Trigger>
				<Tabs.Trigger value="matched">Matched ({results.matched.length})</Tabs.Trigger>
				<Tabs.Trigger value="unexpected">Unexpected ({results.unexpected.length})</Tabs.Trigger>
			</Tabs.List>

			{#each [{ key: 'missing', items: results.missing }, { key: 'matched', items: results.matched }, { key: 'unexpected', items: results.unexpected }] as tab (tab.key)}
				<Tabs.Content value={tab.key}>
					{#if tab.items.length === 0}
						<p class="py-6 text-center text-sm text-muted-foreground">No items in this category.</p>
					{:else}
						<ul class="divide-y divide-border rounded-lg border border-border">
							{#each tab.items as item (item.id)}
								<li class="flex items-center justify-between px-4 py-2 text-sm">
									<div>
										<p class="font-mono-lfc text-xs text-muted-foreground">{item.asset_code}</p>
										{#if item.asset_name}
											<p class="text-xs">{item.asset_name}</p>
										{/if}
									</div>
									<span class="text-muted-foreground">
										{item.scanned_at ? formatDate(item.scanned_at) : '—'}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</Tabs.Content>
			{/each}
		</Tabs.Root>
	{/if}
</div>
