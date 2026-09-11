import { describe, expect, it } from "vitest"

import {
	atlasSource,
	firstNumber,
	integerSourceRect,
	pixelExactScale,
	quadFor,
	wrapTime,
} from "../kernel/atlas"
import {
	categorize,
	classifyClips,
	dueEvents,
	eventsAtFrame,
} from "../kernel/events"
import {
	clipDuration,
	layersAt,
	nextClipName,
	spriteAt,
	valueAt,
} from "../kernel/timeline"
import type {
	CharacterDocument,
	Clip,
	SoundEvent,
	SpriteRecord,
} from "../kernel/types"

const sprite = (name: string, x: number, y: number): SpriteRecord => ({
	name,
	atlas: "atlas.png",
	rect: [x, y, 32, 32],
	pivot: [0.5, 0],
	pixelsToUnit: 100,
})

const clip: Clip = {
	name: "C_idle",
	sampleRate: 30,
	frameCount: 4,
	durationMs: 133.33,
	tracks: [
		{
			layer: "layer0",
			kind: "sprite",
			keys: [
				[0, "a"],
				[33.33, "b"],
				[66.67, null],
			],
		},
		{
			layer: "layer1",
			kind: "sprite",
			keys: [[0, "c"]],
		},
		{
			layer: "layer1",
			kind: "scale",
			curves: [[[0, 1]], [[0, 1]], [[0, 1]]],
		},
		{
			layer: "layer0",
			kind: "position",
			curves: [
				[
					[0, 0],
					[16, 10],
				],
				[[0, 0]],
				[[0, 0]],
			],
		},
	],
	constants: {},
}

const document: CharacterDocument = {
	schemaVersion: 1,
	id: "test",
	name: null,
	sourceGroup: "battle",
	sourceBundle: "test",
	atlases: [{ file: "atlas/atlas.png", width: 64, height: 64 }],
	sprites: [sprite("a", 0, 32), sprite("b", 32, 32), sprite("c", 0, 0)],
	clips: [clip],
	sounds: [],
	layers: [
		{ name: "layer0", sortingOrder: 0, sortingLayer: 0, z: 0 },
		{ name: "layer1", sortingOrder: 0, sortingLayer: 0, z: 0.01 },
	],
	audio: { events: 0, resolved: 0, unresolved: 0 },
	stats: { sprites: 3, clips: 1, soundEvents: 0, maxClipMs: 133.33 },
}

describe("timeline sampling", () => {
	it("holds a value until the next key (stepped sprites)", () => {
		expect(
			spriteAt(
				[
					[0, "a"],
					[33.33, "b"],
					[66.67, null],
				],
				0,
			),
		).toBe("a")
		expect(
			spriteAt(
				[
					[0, "a"],
					[33.33, "b"],
					[66.67, null],
				],
				33.33,
			),
		).toBe("b")
		expect(
			spriteAt(
				[
					[0, "a"],
					[33.33, "b"],
					[66.67, null],
				],
				50,
			),
		).toBe("b")
		expect(
			spriteAt(
				[
					[0, "a"],
					[33.33, "b"],
					[66.67, null],
				],
				80,
			),
		).toBeNull()
		expect(spriteAt([], 10)).toBeNull()
	})

	it("extrapolates constant before the first key", () => {
		expect(valueAt([[10, 5]], 0, 1)).toBe(5)
		expect(valueAt([], 0, 1)).toBe(1)
		expect(
			valueAt(
				[
					[0, 1],
					[10, 2],
				],
				10,
				0,
			),
		).toBe(2)
	})

	it("derives the clip duration from frames and keys", () => {
		expect(clipDuration(clip)).toBeCloseTo(133.33, 1)
		expect(
			clipDuration({ ...clip, durationMs: 0, frameCount: 30, sampleRate: 30 }),
		).toBe(1000)
	})

	it("drops a layer whose scale collapsed and keeps draw order", () => {
		const collapsed: Clip = {
			...clip,
			tracks: [
				clip.tracks[0]!,
				clip.tracks[1]!,
				{
					layer: "layer1",
					kind: "scale",
					curves: [[[0, 0]], [[0, 1]], [[0, 1]]],
				},
			],
		}
		const drawn = layersAt(document, collapsed, 0)
		expect(drawn.map((layer) => layer.layer)).toEqual(["layer0"])
		expect(drawn[0]?.sprite.name).toBe("a")
	})

	it("keeps a layer when it is scaled", () => {
		const scaled = {
			...document,
			clips: [
				{
					...clip,
					tracks: [clip.tracks[0]!, clip.tracks[1]!, clip.tracks[2]!],
				},
			],
		}
		expect(layersAt(scaled, scaled.clips[0]!, 0).map((l) => l.layer)).toEqual([
			"layer0",
			"layer1",
		])
	})

	it("still draws a sprite layer with no transform data at all", () => {
		const bare: Clip = {
			...clip,
			tracks: [{ layer: "layer0", kind: "sprite", keys: [[0, "a"]] }],
			constants: {},
		}
		const [drawn] = layersAt(document, bare, 0)
		expect(drawn?.layer).toBe("layer0")
		expect(drawn?.scale).toEqual([1, 1])
	})

	it("interpolates constant transform curves from the clip constants", () => {
		const withConstants: Clip = {
			...clip,
			tracks: [
				{ layer: "layer0", kind: "sprite", keys: [[0, "a"]] },
				{
					layer: "layer0",
					kind: "position",
					curves: [[[0, 4]], [[0, 2]], [[0, 0]]],
				},
			],
			constants: {
				layer0: { position: [0, 0, 0], scale: [1, 1, 1], euler: [0, 0, 0] },
			},
		}
		const [drawn] = layersAt(document, withConstants, 0)
		expect(drawn?.position).toEqual([4, 2])
		expect(drawn?.scale).toEqual([1, 1])
	})

	it("applies animated position keys", () => {
		const moved = layersAt(
			document,
			{ ...clip, tracks: clip.tracks.slice(0, 1).concat(clip.tracks[3]!) },
			20,
		)
		expect(moved[0]?.position[0]).toBe(10)
	})
})

describe("atlas math", () => {
	it("flips a bottom-left rect into canvas coordinates", () => {
		expect(atlasSource(sprite("a", 0, 32), document)).toEqual([0, 0, 32, 32])
		expect(atlasSource(sprite("c", 0, 0), document)).toEqual([0, 32, 32, 32])
	})

	it("places the sprite so its pivot lands on the layer position", () => {
		const quad = quadFor(sprite("a", 0, 32), [0, 0], [1, 1], 100)
		expect(quad.pivotX).toBe(0)
		expect(quad.pivotY).toBe(0)
		expect(quad.left).toBe(-16)
		expect(quad.width).toBe(32)
		// pivot y = 0 means the sprite sits above the pivot point.
		expect(quad.top).toBe(-32)
	})

	it("scales with zoom and layer scale", () => {
		const quad = quadFor(sprite("a", 0, 32), [1, 2], [2, 2], 200)
		expect(quad.pivotX).toBe(200)
		expect(quad.pivotY).toBe(-400)
		// 32px cell, ppu 100 with 200 canvas px per unit, doubled by scale.
		expect(quad.width).toBe(128)
	})

	it("snaps the scale to whole device pixels", () => {
		// 1 art pixel per device pixel, whatever the display ratio is.
		expect(pixelExactScale(1, 1)).toBe(1)
		expect(pixelExactScale(1, 1.25)).toBe(1)
		expect(pixelExactScale(1, 2)).toBe(2)
		expect(pixelExactScale(2, 1.5)).toBe(3)
		// Zoomed out, whole fractions keep a nearest-neighbour blit exact.
		expect(pixelExactScale(0.5, 1)).toBe(0.5)
		expect(pixelExactScale(0.3, 1)).toBe(1 / 3)
	})

	it("crops the source on whole atlas pixels", () => {
		const fractional = {
			...sprite("a", 0, 32),
			rect: [10.4, 2.6, 31.2, 30.7] as const,
		}
		// Page is 64 tall, so y=2.6 flips to 30.7 and the crop is rounded out.
		expect(integerSourceRect(atlasSource(fractional, document))).toEqual([
			10, 31, 32, 30,
		])
	})

	it("wraps time only when looping", () => {
		expect(wrapTime(150, 100, true)).toBeCloseTo(50)
		expect(wrapTime(-10, 100, true)).toBeCloseTo(90)
		expect(wrapTime(150, 100, false)).toBe(100)
	})

	it("reads a scalar or a range from a slider", () => {
		expect(firstNumber(3, 1)).toBe(3)
		expect(firstNumber([4, 5], 1)).toBe(4)
		expect(firstNumber([], 1)).toBe(1)
	})
})

describe("sound events", () => {
	const sounds: readonly SoundEvent[] = [
		{
			name: "A_1hit",
			frames: [
				{ frame: 1, events: ["event:/a"] },
				{ frame: 3, events: ["event:/b", "event:/c"], volumes: [0.5, 1] },
			],
		},
	]

	it("fires the frames a playhead crossed", () => {
		expect(dueEvents(sounds, clip, 0, 40).map((due) => due.event)).toEqual([
			"event:/a",
		])
		expect(dueEvents(sounds, clip, 0, 120).map((due) => due.event)).toEqual([
			"event:/a",
			"event:/b",
			"event:/c",
		])
		expect(dueEvents(sounds, clip, 40, 60)).toEqual([])
	})

	it("carries the export gain, defaulting to 1.0", () => {
		expect(dueEvents(sounds, clip, 90, 120).map((due) => due.volume)).toEqual([
			0.5, 1,
		])
		expect(dueEvents(sounds, clip, 0, 40).map((due) => due.volume)).toEqual([1])
	})

	it("fires across the loop wrap", () => {
		// Frame 3 sits at 100 ms; the playhead rolls past the 133 ms loop point.
		// Events come back ordered by frame, so the wrapped frame 1 leads.
		expect(dueEvents(sounds, clip, 90, 40).map((due) => due.event)).toEqual([
			"event:/a",
			"event:/b",
			"event:/c",
		])
	})

	it("reports the events bound to one frame", () => {
		expect(eventsAtFrame(sounds, 1).map((due) => due.event)).toEqual([
			"event:/a",
		])
		expect(eventsAtFrame(sounds, 3).map((due) => due.volume)).toEqual([0.5, 1])
		expect(eventsAtFrame(sounds, 2)).toEqual([])
	})
})

describe("clip classification", () => {
	const grouped = (name: string, group?: Clip["group"]): Clip => ({
		...clip,
		name,
		...(group === undefined ? {} : { group }),
	})

	it("buckets a clip by the label the export wrote", () => {
		expect(categorize(grouped("C_idle", "idle"))).toBe("idle")
		expect(categorize(grouped("C_run1_1", "move"))).toBe("move")
		expect(categorize(grouped("A_1hit", "attack"))).toBe("attack")
		expect(categorize(grouped("SP_skill1", "skill"))).toBe("skill")
		expect(categorize(grouped("D_stand_behit1", "damage"))).toBe("damage")
		expect(categorize(grouped("C_land", "state"))).toBe("state")
		expect(categorize(grouped("weird", "other"))).toBe("other")
	})

	it("falls back to other when the export left the label out", () => {
		// Older documents carry no label, and the viewer must not guess one from
		// a clip name: the naming convention belongs to the export.
		expect(categorize(grouped("C_idle"))).toBe("other")
		expect(categorize(grouped("A_1hit"))).toBe("other")
	})

	it("falls back to other for a label outside the union", () => {
		expect(categorize({ ...clip, group: "bogus" as Clip["group"] })).toBe(
			"other",
		)
	})

	it("groups clips in display order", () => {
		const categories = classifyClips([
			grouped("SP_skill1", "skill"),
			grouped("C_idle", "idle"),
			grouped("A_1hit", "attack"),
		])
		expect(categories.map((item) => item.clip.name)).toEqual([
			"C_idle",
			"A_1hit",
			"SP_skill1",
		])
	})
})

describe("action order", () => {
	const named = (name: string): Clip => ({ ...clip, name })
	const list = [named("C_idle"), named("A_1hit"), named("SP_skill1")]

	it("walks the list one action at a time", () => {
		expect(nextClipName(list, "C_idle")).toBe("A_1hit")
		expect(nextClipName(list, "A_1hit")).toBe("SP_skill1")
	})

	it("wraps from the last action back to the first", () => {
		expect(nextClipName(list, "SP_skill1")).toBe("C_idle")
	})

	it("starts from the top for a name the list does not hold", () => {
		expect(nextClipName(list, "")).toBe("C_idle")
		expect(nextClipName(list, "gone")).toBe("C_idle")
		expect(nextClipName([], "C_idle")).toBeUndefined()
	})
})
