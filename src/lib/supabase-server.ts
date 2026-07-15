import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Cookies } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

/**
 * Request-scoped client for server-side routes and load functions —
 * reads/writes the Supabase Auth session via SvelteKit's cookie jar so
 * OAuth sessions survive across requests. Uses the anon key, so it's
 * still subject to RLS (this is the "am I logged in as this user" client,
 * not the admin one).
 *
 * Create a new instance per request — never share one across requests.
 */
export function createSupabaseServerClient(cookies: Cookies) {
	return createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					cookies.set(name, value, { ...options, path: options.path ?? '/' });
				});
			}
		}
	});
}

/**
 * Admin client — bypasses RLS via the service role key. No user session or
 * cookies involved, so a plain client (not the SSR cookie-bound one) is
 * sufficient. Used for privileged operations like looking up auth.users by
 * email and linking/unlinking accounts on the Team page.
 *
 * Import only from server-side code (+page.server.ts, +server.ts,
 * hooks.server.ts). Never import this from a .svelte file or any module
 * reachable by the client bundle.
 */
export function createSupabaseAdminClient() {
	return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});
}
