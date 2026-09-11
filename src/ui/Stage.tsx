import { useEffect, useRef } from "react"

import {
	atlasImageFor,
	atlasSource,
	canvasRotation,
	DEFAULT_PIXELS_PER_UNIT,
	integerSourceRect,
	layersAt,
	pixelExactScale,
	quadFor,
} from "../kernel"
import type { CharacterDocument, Clip } from "../kernel/types"

export type StageProps = {
	readonly document: CharacterDocument
	readonly clip: Clip
	readonly timeMs: number
	readonly atlasImages: ReadonlyMap<string, HTMLImageElement>
	readonly zoom: number
	readonly showGuides: boolean
}

const BACKGROUND_GRID = 64

const paintGuides = (
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
): void => {
	context.save()
	context.strokeStyle = "rgb(127 127 127 / 0.18)"
	context.lineWidth = 1
	const columns = Array.from(
		{ length: Math.ceil(width / BACKGROUND_GRID) },
		(_, index) => index,
	)
	for (const column of columns) {
		const x = column * BACKGROUND_GRID
		context.beginPath()
		context.moveTo(x, 0)
		context.lineTo(x, height)
		context.stroke()
	}
	const rows = Array.from(
		{ length: Math.ceil(height / BACKGROUND_GRID) },
		(_, index) => index,
	)
	for (const row of rows) {
		const y = row * BACKGROUND_GRID
		context.beginPath()
		context.moveTo(0, y)
		context.lineTo(width, y)
		context.stroke()
	}
	context.restore()
}

const paintPivot = (
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
): void => {
	context.save()
	context.strokeStyle = "rgb(220 90 90 / 0.9)"
	context.lineWidth = 1
	context.beginPath()
	context.moveTo(x - 8, y)
	context.lineTo(x + 8, y)
	context.moveTo(x, y - 8)
	context.lineTo(x, y + 8)
	context.stroke()
	context.restore()
}

/**
 * Canvas painter: no state beyond the current frame, all geometry comes from the
 * pure kernel (`layersAt` -> `quadFor`/`atlasSource`). The atlas pages hold
 * sprites that were already cleaned of their neighbours' fragments at export
 * time, so painting is a plain blit.
 */
const paint = (canvas: HTMLCanvasElement, props: StageProps): void => {
	const context = canvas.getContext("2d")
	if (context === null) return
	const ratio = window.devicePixelRatio || 1
	const width = canvas.clientWidth
	const height = canvas.clientHeight
	const targetWidth = Math.max(1, Math.round(width * ratio))
	const targetHeight = Math.max(1, Math.round(height * ratio))
	if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
		canvas.width = targetWidth
		canvas.height = targetHeight
	}
	context.setTransform(ratio, 0, 0, ratio, 0, 0)
	context.clearRect(0, 0, width, height)
	if (props.showGuides) paintGuides(context, width, height)

	const originX = width / 2
	const originY = height * 0.62
	// Whole art pixels per device pixel: fractional scaling (a 125% display, a
	// browser zoom, a fractional zoom slider) is what makes the browser resample
	// every frame, so the scale is snapped instead.
	const pixelsPerUnit =
		(DEFAULT_PIXELS_PER_UNIT * pixelExactScale(props.zoom, ratio)) / ratio
	const snap = (value: number): number => Math.round(value * ratio) / ratio

	for (const layer of layersAt(props.document, props.clip, props.timeMs)) {
		const image = atlasImageFor(layer.sprite, props.atlasImages)
		if (image === undefined) continue
		const source = integerSourceRect(atlasSource(layer.sprite, props.document))
		const quad = quadFor(
			layer.sprite,
			layer.position,
			layer.scale,
			pixelsPerUnit,
		)
		const left = snap(quad.left)
		const top = snap(quad.top)
		const right = snap(quad.left + quad.width)
		const bottom = snap(quad.top + quad.height)
		// Nearest-neighbour at 1:1 and when enlarging (nothing is ever smoothed,
		// so nothing is soft); a layer the animation scales *below* its rect is
		// genuinely downsampled, where dropping pixels would alias instead.
		const deviceScale = ((right - left) * ratio) / source[2]
		context.imageSmoothingEnabled = deviceScale < 1 - 1e-3
		context.imageSmoothingQuality = "high"
		context.save()
		context.translate(snap(originX + quad.pivotX), snap(originY + quad.pivotY))
		context.rotate(canvasRotation(layer.rotation))
		context.drawImage(
			image,
			source[0],
			source[1],
			source[2],
			source[3],
			left,
			top,
			Math.max(1 / ratio, right - left),
			Math.max(1 / ratio, bottom - top),
		)
		context.restore()
	}

	if (props.showGuides) paintPivot(context, originX, originY)
}

export function Stage(props: StageProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (canvas !== null) paint(canvas, props)
	}, [props])

	useEffect(() => {
		const canvas = canvasRef.current
		if (canvas === null) return undefined
		const observer = new ResizeObserver(() => paint(canvas, props))
		observer.observe(canvas)
		return () => observer.disconnect()
	})

	return (
		<canvas
			ref={canvasRef}
			className="block size-full"
			data-testid="frame-stage"
		/>
	)
}
