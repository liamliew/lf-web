// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { TeamMember } from '$lib/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			/** The inventory_team_members row linked to the OAuth user, if any. */
			member: TeamMember | null;
		}
		interface PageData {
			// Optional: only routes under (app) populate these (see
			// (app)/+layout.server.ts). Unauthenticated routes like /login
			// don't have a session/member to report.
			session?: Session | null;
			member?: TeamMember | null;
		}
		// interface PageState {}
		// interface Platform {}
	}

	// Minimal ambient typing for the browser BarcodeDetector API —
	// not yet part of TypeScript's DOM lib. Support: Chrome/Edge/Android
	// WebView; Safari/Firefox fall back to manual entry.
	interface BarcodeDetectorOptions {
		formats?: string[];
	}

	interface DetectedBarcode {
		rawValue: string;
		format: string;
	}

	class BarcodeDetector {
		constructor(options?: BarcodeDetectorOptions);
		static getSupportedFormats(): Promise<string[]>;
		detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
	}
}

export {};
