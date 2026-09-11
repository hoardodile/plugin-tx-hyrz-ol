/**
 * Frame sampling — the heart of the viewer.
 *
 * Character animations are *frame* animations: every clip is a set of 5 draw
 * layers, each with a sprite-swap curve plus position/scale/euler curves, all
 * sampled at the clip's frame rate (30 fps). Sampling is deliberately
 * step-wise for sprites (a sprite key holds until the next one) and linear for
 * the transform curves.
 */

import type {
	CharacterDocument,
	Clip,
	CurveKind,
	CurveTrack,
	LayerConstants,
	LayerDraw,
	LayerInfo,
	SpriteKey,
	SpriteRecord,
	SpriteTrack,
	Track,
	Vec2,
	Vec3,
} from "./types"
import { CURVE_KINDS } from "./types"

/** Sprite swaps are stepped; the epsilon keeps a key at exactly `t` inclusive. */
const EPSILON = 1e-6

const IDENTITY_POSITION: Vec3 = [0, 0, 0]
const IDENTITY_SCALE: Vec3 = [1, 1, 1]

export const isCurveKind = (value: string): value is CurveKind =>
	CURVE_KINDS.some((kind) => kind === value)

export const isSpriteTrack = (track: Track): track is SpriteTrack =>
	track.kind === "sprite"

export const clipDuration = (clip: Clip): number =>
	Math.max(
		clip.durationMs,
		clip.frameCount > 0 ? (clip.frameCount / clip.sampleRate) * 1000 : 0,
	)

export const clipByName = (
	document: CharacterDocument,
	name: string,
): Clip | undefined => document.clips.find((clip) => clip.name === name)

export const defaultClip = (document: CharacterDocument): Clip | undefined =>
	clipByName(document, "C_idle") ?? document.clips.at(0)

export const layerInfos = (document: CharacterDocument): readonly LayerInfo[] =>
	document.layers

/** The value of a scalar curve at `timeMs` (constant before the first key). */
export const valueAt = (
	keys: readonly (readonly [number, number])[],
	timeMs: number,
	fallback: number,
): number => {
	const first = keys.at(0)
	if (first === undefined) return fallback
	return keys.reduce<number>(
		(accumulated, [time, value]) =>
			time <= timeMs + EPSILON ? value : accumulated,
		first[1],
	)
}

/** The sprite a layer shows at `timeMs`; `null` means the layer is not drawn. */
export const spriteAt = (
	keys: readonly SpriteKey[],
	timeMs: number,
): string | null => {
	const first = keys.at(0)
	if (first === undefined) return null
	return keys.reduce<string | null>(
		(accumulated, [time, sprite]) =>
			time <= timeMs + EPSILON ? sprite : accumulated,
		first[1],
	)
}

const vecAt = (
	curves: readonly (readonly (readonly [number, number])[])[],
	timeMs: number,
	fallback: Vec3,
): Vec3 => [
	valueAt(curves.at(0) ?? [], timeMs, fallback[0]),
	valueAt(curves.at(1) ?? [], timeMs, fallback[1]),
	valueAt(curves.at(2) ?? [], timeMs, fallback[2]),
]

const constantsOf = (clip: Clip, layer: string): LayerConstants =>
	clip.constants[layer] ?? {}

const curveTrack = (
	clip: Clip,
	layer: string,
	kind: CurveKind,
): CurveTrack | undefined =>
	clip.tracks.find((track) => track.layer === layer && track.kind === kind) as
		| CurveTrack
		| undefined

/** One layer's resolved transform: animated curves win, constants fill in. */
const transformOf = (
	clip: Clip,
	layer: string,
	timeMs: number,
): { position: Vec2; scale: Vec2; rotation: number } => {
	const constants = constantsOf(clip, layer)
	const position = vecAt(
		curveTrack(clip, layer, "position")?.curves ?? [],
		timeMs,
		constants.position ?? IDENTITY_POSITION,
	)
	const scale = vecAt(
		curveTrack(clip, layer, "scale")?.curves ?? [],
		timeMs,
		constants.scale ?? IDENTITY_SCALE,
	)
	const rotation = valueAt(
		curveTrack(clip, layer, "euler")?.curves.at(2) ?? [],
		timeMs,
		constants.euler?.[2] ?? 0,
	)
	return {
		position: [position[0], position[1]],
		scale: [scale[0], scale[1]],
		rotation,
	}
}

/**
 * Every layer of a clip resolved at `timeMs`, in draw order.
 *
 * The sprite curves decide which layers are drawn (a `null` sprite hides the
 * layer); the transform curves and the clip constants place them. A layer whose
 * scale collapsed to zero is dropped — that is how the game hides a layer it
 * still keys.
 */
export const layersAt = (
	document: CharacterDocument,
	clip: Clip,
	timeMs: number,
): readonly LayerDraw[] => {
	const spriteIndex = new Map(
		document.sprites.map((sprite) => [sprite.name, sprite]),
	)
	const orderOf = new Map(
		document.layers.map((layer) => [
			layer.name,
			layer.sortingLayer * 1000 + layer.sortingOrder * 10 + layer.z * 100,
		]),
	)

	return clip.tracks
		.filter(isSpriteTrack)
		.flatMap((track) => {
			const spriteName = spriteAt(track.keys, timeMs)
			const sprite =
				spriteName === null ? undefined : spriteIndex.get(spriteName)
			if (sprite === undefined) return []
			const transform = transformOf(clip, track.layer, timeMs)
			if (transform.scale[0] === 0 || transform.scale[1] === 0) return []
			return [
				{
					layer: track.layer,
					sprite,
					position: transform.position,
					scale: transform.scale,
					rotation: transform.rotation,
					order: orderOf.get(track.layer) ?? 0,
				} satisfies LayerDraw,
			]
		})
		.sort((left, right) => left.order - right.order)
}

/** Sprite names a clip can show, in first-appearance order (for the contact sheet). */
export const clipSpriteNames = (clip: Clip): readonly string[] => {
	const names = clip.tracks
		.filter(isSpriteTrack)
		.flatMap((track) => track.keys.map(([, sprite]) => sprite))
		.filter((sprite): sprite is string => sprite !== null)
	return [...new Set(names)]
}

/** Total distinct frames a clip plays, used for the frame counter in the UI. */
export const clipFrameTotal = (clip: Clip): number =>
	Math.max(
		clip.frameCount,
		Math.round(clipDuration(clip) / (1000 / clip.sampleRate)),
	)

export const spriteByName = (
	document: CharacterDocument,
	name: string,
): SpriteRecord | undefined =>
	document.sprites.find((sprite) => sprite.name === name)
