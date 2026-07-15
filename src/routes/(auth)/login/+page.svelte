<script lang="ts">
	import { Button } from '$components/ui/button';
	import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
	import AlertCircleIcon from 'lucide-svelte/icons/alert-circle';
	import { supabase } from '$lib/supabase';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let oauthError = $state('');
	let oauthLoading = $state<'google' | 'azure' | null>(null);

	async function signInWithOAuth(provider: 'google' | 'azure') {
		oauthError = '';
		oauthLoading = provider;
		try {
			const { error } = await supabase.auth.signInWithOAuth({
				provider,
				options: {
					redirectTo: `${window.location.origin}/auth/callback`,
					...(provider === 'azure' ? { scopes: 'email' } : {})
				}
			});
			if (error) {
				oauthError = error.message;
				oauthLoading = null;
			}
			// on success the browser navigates away to the provider — no further action needed
		} catch {
			oauthError = 'Could not start sign-in. Try again.';
			oauthLoading = null;
		}
	}
</script>

<svelte:head>
	<title>Sign in — LF Inventory</title>
</svelte:head>

<div class="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-xl">
	<div class="mb-6 flex flex-col items-center gap-2 text-center">
		<div
			class="flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground"
		>
			LF
		</div>
		<h1 class="text-lg font-semibold tracking-tight">LF Inventory</h1>
		<p class="text-sm text-muted-foreground">Sign in to continue</p>
	</div>

	{#if data.error === 'not_registered'}
		<div class="mb-6 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
			<AlertCircleIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
			<div class="space-y-0.5">
				<p class="text-sm font-medium text-destructive">Access Denied</p>
				<p class="text-xs text-muted-foreground">
					Your account is not registered in the LF Inventory system. Contact your administrator to
					be added.
				</p>
			</div>
		</div>
	{/if}

	<div class="space-y-2">
		<Button
			type="button"
			variant="outline"
			class="w-full"
			disabled={oauthLoading !== null}
			onclick={() => signInWithOAuth('google')}
		>
			{#if oauthLoading === 'google'}
				<LoaderCircleIcon class="size-4 animate-spin" />
			{:else}
				<svg class="size-4" viewBox="0 0 24 24" aria-hidden="true">
					<path
						fill="#4285F4"
						d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"
					/>
					<path
						fill="#34A853"
						d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24z"
					/>
					<path
						fill="#FBBC05"
						d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39z"
					/>
					<path
						fill="#EA4335"
						d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75z"
					/>
				</svg>
			{/if}
			Continue with Google
		</Button>

		<Button
			type="button"
			variant="outline"
			class="w-full"
			disabled={oauthLoading !== null}
			onclick={() => signInWithOAuth('azure')}
		>
			{#if oauthLoading === 'azure'}
				<LoaderCircleIcon class="size-4 animate-spin" />
			{:else}
				<svg class="size-4" viewBox="0 0 24 24" aria-hidden="true">
					<rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
					<rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
					<rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
					<rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
				</svg>
			{/if}
			Continue with Microsoft
		</Button>

		{#if oauthError}
			<p class="text-center text-xs text-destructive">{oauthError}</p>
		{/if}
	</div>
</div>
