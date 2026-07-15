<script lang="ts">
	import * as Dialog from '$components/ui/dialog';
	import { Button } from '$components/ui/button';

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		destructive = false,
		onConfirm
	}: {
		open?: boolean;
		title: string;
		description?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		destructive?: boolean;
		onConfirm: () => void | Promise<void>;
	} = $props();

	let submitting = $state(false);

	async function handleConfirm() {
		submitting = true;
		try {
			await onConfirm();
			open = false;
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			{#if description}
				<Dialog.Description>{description}</Dialog.Description>
			{/if}
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)} disabled={submitting}>
				{cancelLabel}
			</Button>
			<Button
				variant={destructive ? 'destructive' : 'default'}
				onclick={handleConfirm}
				disabled={submitting}
			>
				{confirmLabel}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
