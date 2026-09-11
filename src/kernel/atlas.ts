/**
 * Atlas and quad math.
 *
 * Source rects are measured with the origin at the *bottom-left* of the texture
 * and pixels count 100 per world unit, while a canvas counts y downwards. All
 * translation between the two lives here so the renderer stays a dumb painter.
 */

import type {
	AtlasInfo,
	CharacterDocument,
	PivotQuad,
	SpriteRecord,
	Vec2,
} from "./types"

/** Fallback art pixels per world unit, for a sprite that records none. */
export const DEFAULT_PIXELS_PER_UNIT = 100

/**
 * The scale that keeps art pixels on the device grid: at least one device pixel
 * per art pixel, and always a whole number of them (or `1/n` when zoomed out).
 * A fractional scale is what forces the browser to filter every frame.
 */
export const pixelExactScale = (zoom: number, ratio: number): number => {
	const device = zoom * ratio
	if (device >= 1) return Math.max(1, Math.round(device))
	return 1 / Math.max(1, Math.round(1 / Math.max(device, 1e-4)))
}

/** Source rect inside the atlas page, converted to canvas (top-left, y down). */
export const atlasSource = (
	sprite: SpriteRecord,
	document: CharacterDocument,
): readonly [sx: number, sy: number, sw: number, sh: number] => {
	const [, y, width, height] = sprite.rect
	const page: AtlasInfo | undefined = document.atlases.find((atlas) =>
		atlas.file.endsWith(sprite.atlas),
	)
	const pageHeight = page?.height ?? 0
	return [sprite.rect[0], Math.max(0, pageHeight - y - height), width, height]
}

/**
 * Whole-pixel source rect: a fractional crop makes the browser filter even a
 * 1:1 blit, which is the softness visible on rotated or scaled frames.
 */
export const integerSourceRect = (
	source: readonly [sx: number, sy: number, sw: number, sh: number],
): readonly [sx: number, sy: number, sw: number, sh: number] => {
	const left = Math.round(source[0])
	const top = Math.round(source[1])
	return [
		left,
		top,
		Math.max(1, Math.round(source[0] + source[2]) - left),
		Math.max(1, Math.round(source[1] + source[3]) - top),
	]
}

export const atlasSize = (
	sprite: SpriteRecord,
	document: CharacterDocument,
): Vec2 => {
	const page = document.atlases.find((atlas) =>
		atlas.file.endsWith(sprite.atlas),
	)
	return [page?.width ?? 0, page?.height ?? 0]
}

/** `-0` is equal to `0` for maths but not for `Object.is`; normalize it away. */
const plain = (value: number): number => (value === 0 ? 0 : value)

/**
 * Place one sprite: the layer's transform position is the sprite's pivot, so
 * the quad is expressed relative to that pivot and the painter only has to
 * translate, rotate and blit.
 */
export const quadFor = (
	sprite: SpriteRecord,
	position: Vec2,
	scale: Vec2,
	pixelsPerUnit: number,
): PivotQuad => {
	const [, , rectWidth, rectHeight] = sprite.rect
	const ratio = pixelsPerUnit / (sprite.pixelsToUnit || DEFAULT_PIXELS_PER_UNIT)
	const width = rectWidth * ratio * scale[0]
	const height = rectHeight * ratio * scale[1]
	return {
		pivotX: plain(position[0] * pixelsPerUnit),
		pivotY: plain(-position[1] * pixelsPerUnit),
		left: plain(-sprite.pivot[0] * width),
		top: plain(-(1 - sprite.pivot[1]) * height),
		width,
		height,
	}
}

/** Atlas page lookup by the file name recorded on each sprite. */
export const atlasImageFor = (
	sprite: SpriteRecord,
	images: ReadonlyMap<string, HTMLImageElement>,
): HTMLImageElement | undefined =>
	[...images.entries()].find(
		([key]) => key === sprite.atlas || key.endsWith(`/${sprite.atlas}`),
	)?.[1]

/** Degrees (euler z, counter-clockwise) to canvas radians. */
export const canvasRotation = (degrees: number): number =>
	(-degrees * Math.PI) / 180

/** Slider callbacks may hand back a scalar or a range; take the first value. */
export const firstNumber = (
	value: number | readonly number[],
	fallback: number,
): number => {
	if (typeof value === "number") return value
	const first = value.at(0)
	return first === undefined ? fallback : first
}

/** Frame index for a playhead, clamped into the clip. */
export const frameIndex = (
	timeMs: number,
	sampleRate: number,
	total: number,
): number => {
	const index = Math.floor((timeMs / 1000) * sampleRate)
	return Math.min(Math.max(index, 0), Math.max(total - 1, 0))
}

/** Where a clip starts and ends, honouring the loop flag. */
export const wrapTime = (
	timeMs: number,
	durationMs: number,
	loop: boolean,
): number => {
	if (!loop || durationMs <= 0)
		return Math.min(Math.max(timeMs, 0), Math.max(durationMs, 0))
	const wrapped = timeMs % durationMs
	return wrapped < 0 ? wrapped + durationMs : wrapped
}

/** Fit a sprite into a box so the stage can auto-frame on load. */
export const fitScale = (
	sprite: SpriteRecord,
	box: Vec2,
	pixelsPerUnit: number,
): number => {
	const [, , width, height] = sprite.rect
	const scaled =
		Math.max(width, height) * (pixelsPerUnit / (sprite.pixelsToUnit || 100))
	if (scaled <= 0) return 1
	return Math.min(box[0] / scaled, box[1] / scaled) * 0.9
}
