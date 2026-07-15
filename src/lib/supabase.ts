import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Browser client — cookie-backed so the session is visible to
 * hooks.server.ts on subsequent requests (unlike plain @supabase/supabase-js
 * createClient, which only persists to localStorage).
 */
export const supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
