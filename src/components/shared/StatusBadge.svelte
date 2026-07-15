<script lang="ts">
	import type { AssetStatus, ContainerStatus } from '$lib/types';
	import { cn } from '$lib/utils';

	let { status, class: className }: { status: AssetStatus | ContainerStatus; class?: string } =
		$props();

	const config: Record<
		AssetStatus | ContainerStatus,
		{ label: string; dot: string; text: string; bg: string }
	> = {
		available: {
			label: 'Available',
			dot: 'bg-lfc-available',
			text: 'text-lfc-available',
			bg: 'bg-lfc-available/10'
		},
		checked_out: {
			label: 'Checked Out',
			dot: 'bg-lfc-checked-out',
			text: 'text-lfc-checked-out',
			bg: 'bg-lfc-checked-out/10'
		},
		lost: {
			label: 'Lost',
			dot: 'bg-lfc-lost',
			text: 'text-lfc-lost',
			bg: 'bg-lfc-lost/10'
		},
		repair: {
			label: 'Under Repair',
			dot: 'bg-lfc-under-repair',
			text: 'text-lfc-under-repair',
			bg: 'bg-lfc-under-repair/10'
		},
		rented: {
			label: 'Rented',
			dot: 'bg-lfc-checked-out',
			text: 'text-lfc-checked-out',
			bg: 'bg-lfc-checked-out/10'
		},
		in_transit: {
			label: 'In Transit',
			dot: 'bg-lfc-under-repair',
			text: 'text-lfc-under-repair',
			bg: 'bg-lfc-under-repair/10'
		}
	};

	const c = $derived(config[status]);
</script>

<span
	class={cn(
		'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
		c.bg,
		c.text,
		className
	)}
>
	<span class={cn('size-1.5 rounded-full', c.dot)}></span>
	{c.label}
</span>
