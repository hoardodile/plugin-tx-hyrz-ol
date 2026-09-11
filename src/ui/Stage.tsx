import { useEffect } from "react"

import { DEFAULT_PIXELS_PER_UNIT } from "../kernel"
import type { Box } from "../kernel/preview"
import type { CharacterDocument, Clip, Vec2 } from "../kernel/types"
import {
	paintClipFitted,
	STAGE_PADDING_RATIO,
	useCanvasBox,
	useDeviceRatio,
} from "./paint"

export type StageProps = {
	readonly document: CharacterDocument
	readonly clip: Clip
	readonly timeMs: number
	readonly atlasImages: ReadonlyMap<string, HTMLImageElement>
	/** The clip's box across all frames, measured at 1:1. */
	readonly bounds: Box | undefined
}

/**
 * Canvas painter for the inspector: one sampled frame, framed in the viewport.
 *
 * The frame is drawn at one art pixel per device pixel whenever the clip's
 * whole-animation box fits the stage — which is most clips, and is what keeps
 * the view technically exact — and is scaled *down* (never up) when the box is
 * bigger than the stage, so a dash or a jump stays visible instead of landing
 * outside the canvas. Frames are never scaled up, and the scale snaps to whole
 * device pixels per art pixel so a blit is never resampled.
 */
export function Stage(props: StageProps) {
	const { ref, box } = useCanvasBox()
	const ratio = useDeviceRatio()

	useEffect(() => {
		const canvas = ref.current
		if (canvas === null) return
		const { document, clip, timeMs, atlasImages, bounds } = props
		if (bounds === undefined) return
		const dest: Vec2 = [box.width, box.height]
		paintClipFitted(canvas, {
			document,
			clip,
			timeMs,
			atlasImages,
			ratio,
			bounds,
			dest,
			maxPixelsPerUnit: DEFAULT_PIXELS_PER_UNIT,
			paddingRatio: STAGE_PADDING_RATIO,
		})
	}, [props, ratio, box, ref])

	return (
		<canvas ref={ref} className="block size-full" data-testid="frame-stage" />
	)
}
