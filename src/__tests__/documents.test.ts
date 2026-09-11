/**
 * Boundary schema vs. real exported documents.
 *
 * The unit tests build tiny in-memory fixtures, so a field the exporter starts
 * emitting (or stops emitting) can still break every real character. This
 * decodes a spread of exported folders whenever an export is available.
 *
 * Point `FRAME_DATA_ROOT` at an export root (the directory holding
 * `characters/`); without it the test looks for `./unpacked` and skips when the
 * export is absent, which is the normal case for a checkout without data.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { Schema } from "effect"
import { describe, expect, it } from "vitest"

import { CharacterDocumentSchema } from "../boundary/schema"
import { DEFAULT_PIXELS_PER_UNIT } from "../kernel/atlas"
import { clipBoundsFrames, fitClipView } from "../kernel/preview"
import type { CharacterDocument } from "../kernel/types"

const decode = Schema.decodeUnknownSync(CharacterDocumentSchema)

const dataRoot = resolve(process.env.FRAME_DATA_ROOT ?? "unpacked")
const charactersRoot = join(dataRoot, "characters")
const SPREAD = 12

/** First few, every n-th, and the last few exported characters. */
const sampleDocuments = (): string[] => {
	if (!existsSync(charactersRoot)) return []
	const ids = readdirSync(charactersRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((id) => existsSync(join(charactersRoot, id, "character.json")))
		.sort()
	if (ids.length <= SPREAD)
		return ids.map((id) => join(charactersRoot, id, "character.json"))
	const step = Math.max(1, Math.floor(ids.length / SPREAD))
	const picked = new Set<string>()
	for (let index = 0; index < ids.length; index += step) {
		const id = ids[index]
		if (id !== undefined) picked.add(id)
	}
	for (const id of ids.slice(-3)) picked.add(id)
	return [...picked]
		.sort()
		.map((id) => join(charactersRoot, id, "character.json"))
}

describe.skipIf(sampleDocuments().length === 0)("exported documents", () => {
	it("decode against the boundary schema", () => {
		const documents = sampleDocuments()
		expect(documents.length).toBeGreaterThan(0)
		for (const path of documents) {
			const raw: unknown = JSON.parse(readFileSync(path, "utf8"))
			try {
				decode(raw)
			} catch (error) {
				throw new Error(`${path}: ${(error as Error).message.slice(0, 1200)}`)
			}
		}
	})

	/**
	 * A real sprite's pivot can sit outside its own rect, and a layer's position
	 * can carry a pose a long way from the character's origin. The box a tile is
	 * sized to is the union of what every frame draws, so it has to cover the
	 * motion — but a box that spans an atlas page would shrink the character to
	 * nothing. Measure every clip of a spread of real characters and require
	 * both: a box big enough to show the frame, small enough to be a frame.
	 */
	it("measure every clip at a size the viewer can actually show", () => {
		const tile = [150, 120] as const
		for (const path of sampleDocuments()) {
			const document = decode(
				JSON.parse(readFileSync(path, "utf8")),
			) as unknown as CharacterDocument
			for (const clip of document.clips) {
				const bounds = clipBoundsFrames(document, clip)
				if (bounds === undefined) continue
				const fit = fitClipView({
					bounds,
					box: tile,
					maxPixelsPerUnit: 400,
					paddingRatio: 0.98,
					ratio: 1,
					mode: "fit",
					zoom: 1,
				})
				// A measured box counts art pixels, so it is scaled by
				// `pixelsPerUnit / DEFAULT_PIXELS_PER_UNIT` to land in canvas
				// pixels.
				const scale = fit.pixelsPerUnit / DEFAULT_PIXELS_PER_UNIT
				const drawnWidth = bounds[2] * scale
				const drawnHeight = bounds[3] * scale
				expect(
					Math.max(drawnWidth, drawnHeight),
					`${path} ${clip.name}: drawn ${drawnWidth}x${drawnHeight}`,
				).toBeGreaterThan(20)
				expect(drawnWidth).toBeLessThanOrEqual(tile[0] + 1)
				expect(drawnHeight).toBeLessThanOrEqual(tile[1] + 1)
				// The union is the whole animation, so it is normally close to a
				// single pose; only a clip that genuinely travels gets a big box,
				// and even a cross-screen dash stays inside a page.
				expect(
					Math.max(bounds[2], bounds[3]),
					`${path} ${clip.name}: box ${bounds}`,
				).toBeLessThan(2048)
			}
		}
	})
})
