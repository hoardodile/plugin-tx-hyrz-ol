import type { PluginSchema } from "@hoardodile/sdk-types"

/** One file the viewer may need, as advertised to the host file list. */
export type FrameFile = {
	readonly path: string
	readonly kind: "document" | "atlas" | "audio" | "other"
}

/** The summary the viewer renders without re-reading `character.json`. */
export type FrameCharacterSummary = {
	readonly id: string
	readonly name: string | null
	readonly sprites: number
	readonly clips: number
	readonly soundEvents: number
	readonly maxClipMs: number
	readonly atlases: number
	readonly audioResolved: number
	readonly audioEvents: number
}

export type FrameSourceMeta = {
	readonly resource: "character" | "collection"
	readonly files: readonly string[]
	readonly character?: FrameCharacterSummary
	readonly collection?: {
		readonly characters: number
		/** Portrait rigs shipped in the same tree; the viewer only shows the count. */
		readonly portraits: number
		readonly bytes: number
	}
}

/**
 * Declared once and shared between the server definition (`definePlugin`) and
 * the web API (`definePluginAPI`) so both sides stay in sync.
 */
export interface FrameSchema extends PluginSchema {
	readonly file: FrameFile
	readonly sourceMeta: FrameSourceMeta
	/** Classification `detect` spreads onto a match. */
	readonly detect: {
		readonly resource: "character" | "collection"
		readonly id?: string
		readonly files: number
	}
}
