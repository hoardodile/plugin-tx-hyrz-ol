/**
 * The document types the boundary hands to the kernel.
 *
 * They are re-exported here (rather than imported straight from the kernel)
 * so the UI has one import site, and so `AudioMap` — a boundary-only shape —
 * sits next to them.
 */

import type {
	AudioSummary,
	CatalogDocument,
	CharacterDocument,
} from "../kernel/types"

export type { AudioSummary, CatalogDocument, CharacterDocument }

/** One row of `<character>/audio-map.json`: a sound event and what it became. */
export type AudioMapEntry = {
	readonly event: string
	readonly file: string | null
	readonly match: string
}

export type AudioMap = readonly AudioMapEntry[]

/** Where a resource lives: one self-contained character, or a whole collection. */
export type ResourceKind =
	| { readonly kind: "character"; readonly path: string }
	| { readonly kind: "collection"; readonly path: string }

export const CHARACTER_FILE = "character.json"
export const CATALOG_FILE = "catalog.json"
export const AUDIO_MAP_FILE = "audio-map.json"

/** Root-level file, or the first nested one plus its directory. */
const locate = (
	files: readonly string[],
	name: string,
): { readonly atRoot: boolean; readonly directory: string } | undefined => {
	if (files.includes(name)) return { atRoot: true, directory: "" }
	const nested = files.find((file) => file.endsWith(`/${name}`))
	if (nested === undefined) return undefined
	return { atRoot: false, directory: nested.slice(0, -`/${name}`.length) }
}

/**
 * Decide what this resource is from its file list.
 *
 * A root-level `catalog.json` wins over the nested `characters/<id>/character.json`
 * files it indexes, otherwise a whole collection would be mistaken for a
 * single character folder. Mirrors the server-side `detect` classification.
 */
export const classifyResource = (
	files: readonly string[],
): ResourceKind | undefined => {
	const catalog = locate(files, CATALOG_FILE)
	if (catalog !== undefined)
		return { kind: "collection", path: catalog.directory }
	const character = locate(files, CHARACTER_FILE)
	if (character !== undefined)
		return { kind: "character", path: character.directory }
	return undefined
}
