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
})
