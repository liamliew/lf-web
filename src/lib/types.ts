/**
 * Shared data model — mirrors the actual Supabase schema used by the
 * lf-scan Android app (tables: inventory_assets, inventory_containers,
 * inventory_locations, inventory_events, inventory_container_events,
 * inventory_team_members, inventory_audits, inventory_audit_items,
 * inventory_sessions, inventory_session_items). Both apps read/write the
 * same tables, so field names here must match the DB columns exactly.
 */

export type AssetStatus = 'available' | 'checked_out' | 'repair' | 'lost' | 'rented';
export type ContainerStatus = 'available' | 'checked_out' | 'in_transit' | 'rented';

export type AssetEventType =
	| 'created'
	| 'checkout'
	| 'checkin'
	| 'location'
	| 'repair'
	| 'lost'
	| 'edited'
	| 'inquiry'
	| 'rented'
	| 'returned';

export type ContainerEventType =
	| 'check_in'
	| 'check_out'
	| 'location_update'
	| 'asset_added'
	| 'asset_removed'
	| 'created'
	| 'rented'
	| 'returned';

export type AuditStatus = 'in_progress' | 'completed' | 'cancelled';
export type AuditItemResult = 'pending' | 'matched' | 'unexpected' | 'missing';
export type TeamMemberRole = 'Admin' | 'Member';
export type SessionMode = 'Check Out' | 'Check In' | 'Update' | 'Inquiry' | 'mark_lost';
export type CostTier = 'Low' | 'Med' | 'High';
export type SizeTier = 'S' | 'M' | 'L';

/**
 * The primary key is `asset_id` — a short human-entered/scanned text code
 * (e.g. "2817"), not a generated UUID. It doubles as the barcode value.
 */
export interface Asset {
	asset_id: string;
	name: string;
	category: string;
	type: string | null;
	size: string;
	cost: string;
	status: AssetStatus;
	notes: string | null;
	photo_urls: string[];
	current_location_id: string | null;
	current_user_id: string | null;
	current_user_name: string | null;
	created_at: string;
	updated_at: string;
	serial_number: string | null;
	container_id: string | null;
	container_locked: boolean;
	renter_contact: string | null;
	rental_due_date: string | null;
	last_known_lat: number | null;
	last_known_lng: number | null;
	last_known_address: string | null;
	last_known_at: string | null;
}

export type CreateAssetInput = Pick<Asset, 'asset_id' | 'name' | 'category'> &
	Partial<
		Pick<
			Asset,
			'type' | 'size' | 'cost' | 'notes' | 'current_location_id' | 'status' | 'photo_urls'
		>
	>;

/** PK is `id` (uuid); `container_id` is a separate human-readable code. */
export interface Container {
	id: string;
	container_id: string;
	name: string;
	description: string | null;
	status: ContainerStatus;
	current_location_id: string | null;
	current_user_id: string | null;
	current_user_name: string | null;
	created_at: string;
	updated_at: string;
	renter_contact: string | null;
	rental_due_date: string | null;
}

export type CreateContainerInput = Pick<Container, 'container_id' | 'name'> &
	Partial<Pick<Container, 'description' | 'current_location_id' | 'status'>>;

export interface Location {
	id: string;
	name: string;
	description: string;
	location_code: string | null;
	created_at: string;
}

export type CreateLocationInput = Pick<Location, 'name'> &
	Partial<Pick<Location, 'description' | 'location_code'>>;

/** Asset activity — created/checkout/checkin/location/repair/lost/etc. */
export interface InventoryEvent {
	id: string;
	asset_id: string;
	event_type: AssetEventType;
	performed_by: string | null;
	performed_by_name: string | null;
	note: string | null;
	gps_lat: number | null;
	gps_lng: number | null;
	gps_address: string | null;
	created_at: string;
	location_id: string | null;
}

/** Container activity — a separate table/timeline from asset events. */
export interface ContainerEvent {
	id: string;
	container_id: string;
	event_type: ContainerEventType;
	performed_by: string;
	performed_by_name: string;
	location_id: string | null;
	location_name: string | null;
	gps_lat: number | null;
	gps_lng: number | null;
	gps_address: string | null;
	notes: string | null;
	created_at: string;
}

export interface TeamMember {
	id: string;
	name: string;
	pin: string;
	role: TeamMemberRole;
	clerk_user_id: string | null;
	created_at: string;
	password: string | null;
	/** Links this member to a Supabase Auth user (auth.users.id) for OAuth sign-in. */
	supabase_auth_id: string | null;
}

export type CreateTeamMemberInput = Pick<TeamMember, 'pin' | 'password' | 'name' | 'role'>;

export interface Audit {
	id: string;
	location_id: string | null;
	location_name: string;
	performed_by: string;
	performed_by_name: string;
	status: AuditStatus;
	total_expected: number;
	total_scanned: number;
	total_matched: number;
	total_missing: number;
	total_unexpected: number;
	started_at: string;
	completed_at: string | null;
}

export interface AuditItem {
	id: string;
	audit_id: string;
	asset_id: string | null;
	asset_code: string;
	asset_name: string | null;
	expected: boolean;
	scanned: boolean;
	result: AuditItemResult;
	scanned_at: string | null;
}

/** Batch check-in/check-out/update workflow used by lf-scan. */
export interface ScanSession {
	id: string;
	mode: SessionMode;
	user_id: string | null;
	user_name: string | null;
	location_id: string | null;
	committed_at: string | null;
	created_at: string;
}

export interface ScanSessionItem {
	id: string;
	session_id: string;
	asset_id: string;
	created_at: string;
}
