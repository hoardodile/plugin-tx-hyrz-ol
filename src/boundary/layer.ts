/**
 * Boundary: the Effect layer the viewer runs on, plus the load programs.
 */

import { Effect, Layer, ManagedRuntime } from "effect"

import { htmlAudioLayer } from "./audio"
import type {
	CatalogDocument,
	CharacterDocument,
	ResourceKind,
} from "./documents"
import { AUDIO_MAP_FILE, CATALOG_FILE, CHARACTER_FILE } from "./documents"
import {
	loadAudioMap,
	loadCatalog,
	loadCharacter,
	loadImage,
	makeResourceAccess,
	type ResourceAccess,
	type ResourceAccessShape,
} from "./resource"

export const makeRuntime = (access: ResourceAccessShape) =>
	ManagedRuntime.make(Layer.merge(makeResourceAccess(access), htmlAudioLayer))

export type ViewerRuntime = ReturnType<typeof makeRuntime>

export const characterPath = (base: string): string =>
	base.length === 0
		? CHARACTER_FILE
		: `${base.replace(/\/$/, "")}/${CHARACTER_FILE}`

export const catalogPath = (base: string): string =>
	base.length === 0
		? CATALOG_FILE
		: `${base.replace(/\/$/, "")}/${CATALOG_FILE}`

export const audioMapPath = (base: string): string =>
	base.length === 0
		? AUDIO_MAP_FILE
		: `${base.replace(/\/$/, "")}/${AUDIO_MAP_FILE}`

export type LoadedCharacter = {
	readonly document: CharacterDocument
	readonly atlasImages: ReadonlyMap<string, HTMLImageElement>
}

/** Directory part of a character document path (`characters/<id>/`), with slash. */
export const directoryOf = (path: string): string => {
	const cut = path.lastIndexOf("/")
	return cut < 0 ? "" : path.slice(0, cut + 1)
}

/**
 * Load a character document and every atlas page it references.
 *
 * The document's inner paths (`atlas/x.png`, `audio/y.ogg`) are relative to the
 * character folder, which is the resource root only in the single-character
 * case — inside a collection every inner path needs the folder prefix. The
 * image map is still keyed by the document's own inner path, which is what the
 * kernel matches sprite `atlas` names against.
 */
export const loadDocument = (path: string) =>
	Effect.gen(function* () {
		const document = yield* loadCharacter(path)
		const directory = directoryOf(path)
		const entries = yield* Effect.forEach(
			document.atlases,
			(atlas) =>
				loadImage(`${directory}${atlas.file}`).pipe(
					Effect.map((image) => [atlas.file, image] as const),
				),
			{ concurrency: 4 },
		)
		return { document, atlasImages: new Map(entries) } satisfies LoadedCharacter
	})

export const loadCollection = (
	path: string,
): Effect.Effect<CatalogDocument, never, ResourceAccess> =>
	Effect.gen(function* () {
		return yield* loadCatalog(path)
	}).pipe(Effect.orDie)

export const loadAudioMapOptional = (path: string) =>
	loadAudioMap(path).pipe(Effect.catch(() => Effect.succeed([])))

export type { ResourceKind }
