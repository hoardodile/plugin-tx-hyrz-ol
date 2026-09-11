import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createDirectoryResourceAPI } from "@hoardodile/host"
import { createResourceAPIFixture } from "@hoardodile/sdk-server"
import plugin from "../main"
import type { FrameSchema } from "../shared"

const characterDocument = {
	schemaVersion: 1,
	id: "11000111",
	name: null,
	sourceGroup: "battle",
	sourceBundle: "assetbundles/battle/ninja_11000111",
	sourceFormat: { container: "asset-bundle", version: 8 },
	atlases: [{ file: "atlas/Image_1.png", width: 1024, height: 1024 }],
	sprites: [],
	clips: [],
	sounds: [],
	layers: [],
	points: [],
	audio: { events: 4, resolved: 1, unresolved: 3 },
	stats: { sprites: 150, clips: 75, soundEvents: 42, maxClipMs: 3100 },
}

describe("character frame plugin", () => {
	it("detects a self-contained character folder", async () => {
		const { api } = createResourceAPIFixture<FrameSchema>({
			files: ["character.json", "atlas/Image_1.png", "cover.png"],
		})
		const result = await plugin.detect(api)
		expect(result).toEqual({
			ok: true,
			resource: "character",
			id: undefined,
			files: 3,
		})
	})

	it("detects the export collection root", async () => {
		const { api } = createResourceAPIFixture<FrameSchema>({
			files: ["catalog.json", "characters/11000111/character.json"],
		})
		const result = await plugin.detect(api)
		expect(result).toMatchObject({ ok: true, resource: "collection" })
	})

	it("misses anything else", async () => {
		const { api } = createResourceAPIFixture<FrameSchema>({
			files: ["photo.jpg"],
		})
		const result = await plugin.detect(api)
		expect(result.ok).toBe(false)
	})

	it("summarizes a character in sourceMeta", async () => {
		const { api } = createResourceAPIFixture<FrameSchema>({
			files: ["character.json", "atlas/Image_1.png"],
			contents: { "character.json": JSON.stringify(characterDocument) },
		})
		const meta = await plugin.sourceMeta?.(api)
		expect(meta?.character).toEqual({
			id: "11000111",
			name: null,
			sprites: 150,
			clips: 75,
			soundEvents: 42,
			maxClipMs: 3100,
			atlases: 1,
			audioResolved: 1,
			audioEvents: 4,
		})
	})

	it("classifies files for the viewer", async () => {
		const { api } = createResourceAPIFixture<FrameSchema>({
			files: [
				"character.json",
				"atlas/Image_1.png",
				"audio/a.ogg",
				"notes.txt",
			],
		})
		const files = await plugin.listFiles?.(api)
		expect(files?.map((file) => file.kind)).toEqual([
			"document",
			"atlas",
			"audio",
			"other",
		])
	})

	it("uses cover.png when present", async () => {
		const { api } = createResourceAPIFixture<FrameSchema>({
			files: ["character.json", "cover.png"],
		})
		expect(await plugin.coverLocal?.(api)).toBe("cover.png")
	})
})

// Layer 2 (see "Testing" in the plugin development docs): the hooks against
// real files on disk.
describe("against real files", () => {
	let dir: string

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true })
	})

	it("detects and summarizes an exported character directory", async () => {
		dir = mkdtempSync(join(tmpdir(), "frame-test-"))
		writeFileSync(
			join(dir, "character.json"),
			JSON.stringify(characterDocument),
		)
		writeFileSync(join(dir, "cover.png"), "")
		const api = createDirectoryResourceAPI<FrameSchema>(dir)
		const result = await plugin.detect(api)
		expect(result).toMatchObject({ ok: true, resource: "character" })
		const meta = await plugin.sourceMeta?.(api)
		expect(meta?.character?.clips).toBe(75)
		expect(await plugin.coverLocal?.(api)).toBe("cover.png")
	})
})
