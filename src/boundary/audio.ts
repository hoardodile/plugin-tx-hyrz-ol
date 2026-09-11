/**
 * Boundary: audio playback.
 *
 * Resolved samples are plain files in the resource, so playback is an
 * `HTMLAudioElement` pool. The service keeps the pool behind Effect so the
 * viewer can fire a frame's events without touching the DOM itself.
 */

import { Context, Effect, Layer } from "effect"

export type AudioChannel = {
	readonly play: (url: string, volume: number) => Effect.Effect<void>
	readonly stopAll: Effect.Effect<void>
}

export class AudioPlayer extends Context.Service<AudioPlayer, AudioChannel>()(
	"frame/AudioPlayer",
) {}

const MAX_CONCURRENT = 6

/**
 * HTMLAudio has no gain stage above 1.0, while the export's config uses gains
 * up to 5.0 to mix loud effects: clamp so a >1 gain is at least played
 * full-scale.
 */
export const clampVolume = (volume: number): number =>
	Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1

const makeHtmlAudioChannel = (): AudioChannel => {
	const pool: HTMLAudioElement[] = []
	const playing = new Set<HTMLAudioElement>()

	const stopAll = Effect.sync(() => {
		for (const element of playing) {
			element.pause()
			element.currentTime = 0
		}
		playing.clear()
	})

	const play = (url: string, volume: number) =>
		Effect.sync(() => {
			const element = pool.pop() ?? new Audio()
			element.src = url
			element.volume = clampVolume(volume)
			element.currentTime = 0
			playing.add(element)
			element.onended = () => {
				playing.delete(element)
				if (pool.length < MAX_CONCURRENT) pool.push(element)
			}
			void element.play().catch(() => {
				playing.delete(element)
				if (pool.length < MAX_CONCURRENT) pool.push(element)
			})
		})

	return { play, stopAll }
}

export const htmlAudioLayer: Layer.Layer<AudioPlayer> = Layer.sync(
	AudioPlayer,
	makeHtmlAudioChannel,
)

export const silentAudioLayer: Layer.Layer<AudioPlayer> = Layer.succeed(
	AudioPlayer,
	{
		play: () => Effect.void,
		stopAll: Effect.void,
	},
)

export const playUrl = Effect.fn("playUrl")(function* (
	url: string,
	volume = 1,
) {
	const player = yield* AudioPlayer
	yield* player.play(url, volume)
})

export const stopAll = Effect.fn("stopAll")(function* () {
	const player = yield* AudioPlayer
	yield* player.stopAll
})
