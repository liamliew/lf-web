import { toast } from 'svelte-sonner';

/**
 * Thin wrapper around svelte-sonner so the rest of the app depends on a
 * stable local module instead of the third-party package directly.
 */
export const notify = {
	success: (message: string, description?: string) => toast.success(message, { description }),
	error: (message: string, description?: string) => toast.error(message, { description }),
	info: (message: string, description?: string) => toast(message, { description }),
	promise: toast.promise
};
