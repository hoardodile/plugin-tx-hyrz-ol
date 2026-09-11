/**
 * Where a resource's data lives inside the plugin sandbox.
 *
 * A single character folder is the resource root; a collection holds a catalog
 * and one folder per character under `characters/`. Both views resolve paths
 * through here so the prefix rule is written once.
 */

import type { ResourceKind } from "../boundary/documents"

const COLLECTION_PREFIX = "characters/"

/** Folder of one character, with a trailing slash, or `""` when unknown. */
export const characterDirectory = (
	kind: ResourceKind | undefined,
	selectedId: string | null,
	directory: string | undefined,
): string => {
	if (kind === undefined) return ""
	const prefix = kind.path.length === 0 ? "" : `${kind.path}/`
	if (kind.kind === "character") return prefix
	if (selectedId === null) return ""
	const folder = directory ?? `${COLLECTION_PREFIX}${selectedId}`
	return `${prefix}${folder}/`
}

/** Resolve an audio-map file (relative to the character folder) to a path. */
export const resolveAudioFile = (directory: string, file: string): string =>
	file.startsWith("/") || directory.length === 0 ? file : `${directory}${file}`
