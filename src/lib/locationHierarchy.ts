import type { Location } from '$lib/types';

/**
 * Pure helpers for the free-form location hierarchy (inventory_locations.parent_id).
 * Any location can parent any other, so every walk here guards against
 * cycles rather than trusting the data to be a tree.
 */

export type LocationsById = Record<string, Location>;

export function indexLocations(locations: Location[]): LocationsById {
	return Object.fromEntries(locations.map((l) => [l.id, l]));
}

/** Root-first ancestor chain, including the location itself. Stops on a cycle. */
export function locationChain(id: string | null | undefined, byId: LocationsById): Location[] {
	const chain: Location[] = [];
	const seen = new Set<string>();
	let current = id ? byId[id] : undefined;
	while (current && !seen.has(current.id)) {
		seen.add(current.id);
		chain.unshift(current);
		current = current.parent_id ? byId[current.parent_id] : undefined;
	}
	return chain;
}

/** "Warehouse › Shelf A › Drybox 3" */
export function locationPath(id: string | null | undefined, byId: LocationsById): string {
	return locationChain(id, byId)
		.map((l) => l.name)
		.join(' › ');
}

export function childrenOf(id: string, locations: Location[]): Location[] {
	return locations.filter((l) => l.parent_id === id);
}

/**
 * The location itself plus everything nested under it, at any depth. Used to
 * stop a location being moved under its own descendant (which would create a
 * cycle) in the parent picker.
 */
export function selfAndDescendantIds(id: string, locations: Location[]): Set<string> {
	const result = new Set<string>([id]);
	let frontier = [id];
	while (frontier.length > 0) {
		const next: string[] = [];
		for (const l of locations) {
			if (l.parent_id && frontier.includes(l.parent_id) && !result.has(l.id)) {
				result.add(l.id);
				next.push(l.id);
			}
		}
		frontier = next;
	}
	return result;
}

/** Valid parent choices for `id` (all locations when creating a new one). */
export function parentOptions(id: string | null, locations: Location[]): Location[] {
	const excluded = id ? selfAndDescendantIds(id, locations) : new Set<string>();
	return locations.filter((l) => !excluded.has(l.id));
}

/** Depth-first ordering with depth, for rendering an indented tree. */
export function flattenTree(locations: Location[]): { location: Location; depth: number }[] {
	const byId = indexLocations(locations);
	const byName = (a: Location, b: Location) => a.name.localeCompare(b.name);
	const out: { location: Location; depth: number }[] = [];
	const visited = new Set<string>();

	function visit(l: Location, depth: number) {
		if (visited.has(l.id)) return;
		visited.add(l.id);
		out.push({ location: l, depth });
		for (const child of childrenOf(l.id, locations).sort(byName)) visit(child, depth + 1);
	}

	// Roots: no parent, or a parent that no longer exists.
	for (const root of locations.filter((l) => !l.parent_id || !byId[l.parent_id]).sort(byName)) {
		visit(root, 0);
	}
	// Anything left is part of a cycle with no root — still show it rather than hide data.
	for (const l of [...locations].sort(byName)) visit(l, 0);
	return out;
}
