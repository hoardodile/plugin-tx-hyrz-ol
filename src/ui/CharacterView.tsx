import { Badge } from "@hoardodile/ui/components/badge"
import { Button } from "@hoardodile/ui/components/button"
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@hoardodile/ui/components/empty"
import { Icon } from "@hoardodile/ui/components/icon"
import { Label } from "@hoardodile/ui/components/label"
import { SectionLabel } from "@hoardodile/ui/components/section-label"
import { Separator } from "@hoardodile/ui/components/separator"
import { Skeleton } from "@hoardodile/ui/components/skeleton"
import { Slider } from "@hoardodile/ui/components/slider"
import { Switch } from "@hoardodile/ui/components/switch"
import {
	Layers,
	Maximize,
	Pause,
	Play,
	Refresh,
	Restart,
	VideoFrame,
} from "@hoardodile/ui/icons/registry"
import { Effect } from "effect"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { playUrl, stopAll } from "../boundary/audio"
import type {
	AudioMap,
	CatalogDocument,
	CharacterDocument,
} from "../boundary/documents"
import { classifyResource } from "../boundary/documents"
import {
	audioMapPath,
	catalogPath,
	characterPath,
	loadAudioMapOptional,
	loadDocument,
	makeRuntime,
} from "../boundary/layer"
import type { ResourceAccessShape } from "../boundary/resource"
import { fileUrl, loadCatalog } from "../boundary/resource"
import { usePluginAPI } from "../hooks"
import { useTranslation } from "../i18n"
import {
	clipDuration,
	clipFrameTotal,
	clipSpriteNames,
	dueEvents,
	eventsAtFrame,
	firstNumber,
	frameIndex,
	layersAt,
	wrapTime,
} from "../kernel"
import type { Clip } from "../kernel/types"
import { AudioPanel } from "./AudioPanel"
import { ClipList } from "./ClipList"
import { Stage } from "./Stage"

type LoadedState =
	| { readonly status: "loading" }
	| { readonly status: "error"; readonly message: string }
	| {
			readonly status: "ready"
			readonly document: CharacterDocument
			readonly atlasImages: ReadonlyMap<string, HTMLImageElement>
			readonly audioMap: AudioMap
	  }

const COLLECTION_PREFIX = "characters/"

export function CharacterView() {
	const api = usePluginAPI()
	const { t } = useTranslation()

	const runtime = useMemo(
		() =>
			makeRuntime({
				readBytes: (path: string) => api.readFile(path),
				resolveFileUrl: (path: string) => api.resolveFileUrl(path),
			} satisfies ResourceAccessShape),
		[api],
	)
	useEffect(() => () => void runtime.dispose(), [runtime])

	const sourceMeta = api.resource.sourceMeta
	const kind = useMemo(
		() => classifyResource(sourceMeta?.files ?? []),
		[sourceMeta],
	)

	const [catalog, setCatalog] = useState<CatalogDocument | null>(null)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [state, setState] = useState<LoadedState>({ status: "loading" })
	const [clipName, setClipName] = useState<string>("")
	const [timeMs, setTimeMs] = useState(0)
	const [playing, setPlaying] = useState(true)
	const [speed, setSpeed] = useState(1)
	const [loop, setLoop] = useState(true)
	const [zoom, setZoom] = useState(1)
	const [guides, setGuides] = useState(false)
	const [audioEnabled, setAudioEnabled] = useState(true)

	// Collection resources hold many characters: read the catalog, then load
	// whichever one the user picked.
	useEffect(() => {
		if (kind?.kind !== "collection") return undefined
		let cancelled = false
		runtime
			.runPromise(loadCatalog(catalogPath(kind.path)))
			.then((loaded) => {
				if (cancelled) return
				setCatalog(loaded)
				setSelectedId(
					(current) => current ?? loaded.characters.at(0)?.id ?? null,
				)
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: "error", message: String(error) })
			})
		return () => {
			cancelled = true
		}
	}, [kind, runtime])

	const characterPathFor = useMemo(() => {
		if (kind === undefined) return null
		const prefix = kind.path.length === 0 ? "" : `${kind.path}/`
		if (kind.kind === "character") return prefix
		if (selectedId === null) return null
		const entry = catalog?.characters.find((item) => item.id === selectedId)
		// The catalog records the folder relative to itself; fall back to the
		// documented export layout when an older catalog has no `directory`.
		const directory = entry?.directory ?? `${COLLECTION_PREFIX}${selectedId}`
		return `${prefix}${directory}/`
	}, [kind, selectedId, catalog])

	useEffect(() => {
		if (characterPathFor === null) return undefined
		let cancelled = false
		setState({ status: "loading" })
		runtime
			.runPromise(
				Effect.gen(function* () {
					const loaded = yield* loadDocument(characterPath(characterPathFor))
					const audioMap = yield* loadAudioMapOptional(
						audioMapPath(characterPathFor),
					)
					return { ...loaded, audioMap }
				}),
			)
			.then((loaded) => {
				if (cancelled) return
				setState({ status: "ready", ...loaded })
				setClipName((current) =>
					loaded.document.clips.some((clip) => clip.name === current)
						? current
						: (loaded.document.clips.find((clip) => clip.name === "C_idle")
								?.name ??
							loaded.document.clips.at(0)?.name ??
							""),
				)
				setTimeMs(0)
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: "error", message: String(error) })
			})
		return () => {
			cancelled = true
		}
	}, [characterPathFor, runtime])

	const document = state.status === "ready" ? state.document : undefined
	const clip = document?.clips.find((item) => item.name === clipName)
	const duration = clip === undefined ? 0 : clipDuration(clip)

	// `audio-map.json` lists files relative to the character folder, so inside a
	// collection the folder prefix has to be re-attached before resolving a URL.
	const playFile = useCallback(
		(file: string, volume: number) => {
			if (!audioEnabled) return
			const resolved =
				file.startsWith("/") || characterPathFor === null
					? file
					: `${characterPathFor}${file}`
			void runtime.runPromise(
				Effect.gen(function* () {
					const url = yield* fileUrl(resolved)
					yield* playUrl(url, volume)
				}),
			)
		},
		[audioEnabled, runtime, characterPathFor],
	)

	const audioFileFor = useCallback(
		(event: string) =>
			state.status === "ready"
				? (state.audioMap.find((entry) => entry.event === event)?.file ?? null)
				: null,
		[state],
	)

	// Playback loop: rAF drives the playhead, and every frame crossed fires the
	// clip's configured sound events (the loop wrap included).
	const previousTime = useRef(0)
	useEffect(() => {
		if (!playing || clip === undefined || duration <= 0) return undefined
		let handle = 0
		let last = performance.now()
		const tick = (now: number) => {
			const delta = now - last
			last = now
			setTimeMs((current) => {
				const advanced = current + delta * speed
				const next = wrapTime(advanced, duration, loop)
				if (audioEnabled) {
					const sounds =
						document?.sounds.filter((sound) => sound.name === clip.name) ?? []
					for (const due of dueEvents(sounds, clip, current, next)) {
						const file = audioFileFor(due.event)
						if (file !== null) playFile(file, due.volume)
					}
				}
				previousTime.current = next
				return next
			})
			if (!loop && previousTime.current >= duration) {
				setPlaying(false)
				return
			}
			handle = requestAnimationFrame(tick)
		}
		handle = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(handle)
	}, [
		playing,
		clip,
		duration,
		speed,
		loop,
		audioEnabled,
		document,
		audioFileFor,
		playFile,
	])

	const stepFrame = useCallback(
		(delta: number) => {
			if (clip === undefined) return
			setPlaying(false)
			const frameMs = 1000 / clip.sampleRate
			setTimeMs((current) =>
				wrapTime(current + delta * frameMs, duration, loop),
			)
			const frame = frameIndex(
				timeMs + delta * frameMs,
				clip.sampleRate,
				clipFrameTotal(clip),
			)
			const sounds =
				document?.sounds.filter((sound) => sound.name === clip.name) ?? []
			for (const due of eventsAtFrame(sounds, frame)) {
				const file = audioFileFor(due.event)
				if (file !== null) playFile(file, due.volume)
			}
		},
		[clip, duration, loop, timeMs, document, audioFileFor, playFile],
	)

	if (kind === undefined) {
		return (
			<div className="flex size-full items-center justify-center p-6">
				<Empty>
					<EmptyHeader>
						<EmptyTitle>{t("error.notCharacter")}</EmptyTitle>
						<EmptyDescription>{t("error.notCharacterHint")}</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</div>
		)
	}

	return (
		<div className="flex size-full min-h-0 bg-background text-foreground">
			<aside className="flex w-sidebar min-w-0 flex-col border-border border-r">
				<div className="flex flex-col gap-1 px-3 py-2">
					<SectionLabel>
						{kind.kind === "collection"
							? t("picker.characters")
							: t("picker.clips")}
					</SectionLabel>
					{kind.kind === "collection" && catalog !== null ? (
						<div className="max-h-40 overflow-auto">
							{catalog.characters.map((entry) => (
								<Button
									key={entry.id}
									size="sm"
									variant={entry.id === selectedId ? "secondary" : "ghost"}
									active={entry.id === selectedId}
									className="w-full justify-start"
									onClick={() => setSelectedId(entry.id)}
								>
									<span className="truncate">{entry.name ?? entry.id}</span>
								</Button>
							))}
						</div>
					) : null}
				</div>
				<Separator />
				<div className="min-h-0 flex-1">
					{document === undefined ? (
						<div className="flex flex-col gap-2 p-3">
							<Skeleton className="h-control w-full" />
							<Skeleton className="h-control w-full" />
						</div>
					) : (
						<ClipList
							clips={document.clips}
							value={clipName}
							onChange={(name) => {
								setClipName(name)
								setTimeMs(0)
							}}
						/>
					)}
				</div>
			</aside>

			<main className="flex min-w-0 flex-1 flex-col">
				<header className="flex items-center justify-between gap-2 border-border border-b px-3 py-2">
					<div className="flex min-w-0 items-center gap-2">
						<Icon icon={VideoFrame} size="md" />
						<span className="truncate text-sm">
							{document?.name ?? document?.id ?? api.resource.name}
						</span>
						<Badge variant="outline">{document?.id ?? "…"}</Badge>
						<Badge variant="secondary">
							{t("stats.counts", {
								sprites: document?.stats.sprites ?? 0,
								clips: document?.stats.clips ?? 0,
							})}
						</Badge>
					</div>
					<div className="flex items-center gap-1">
						<Button
							size="icon-sm"
							variant="ghost"
							aria-label={t("controls.stepBack")}
							onClick={() => stepFrame(-1)}
						>
							<Icon icon={Refresh} size="sm" className="-scale-x-100" />
						</Button>
						<Button
							size="icon-sm"
							variant="ghost"
							aria-label={playing ? t("controls.pause") : t("controls.play")}
							onClick={() => setPlaying((current) => !current)}
						>
							<Icon icon={playing ? Pause : Play} size="sm" />
						</Button>
						<Button
							size="icon-sm"
							variant="ghost"
							aria-label={t("controls.stepForward")}
							onClick={() => stepFrame(1)}
						>
							<Icon icon={Refresh} size="sm" />
						</Button>
						<Button
							size="icon-sm"
							variant="ghost"
							aria-label={t("controls.restart")}
							onClick={() => {
								setTimeMs(0)
								void runtime.runPromise(stopAll())
							}}
						>
							<Icon icon={Restart} size="sm" />
						</Button>
					</div>
				</header>

				<div className="relative min-h-0 flex-1">
					{state.status === "error" ? (
						<div className="flex size-full items-center justify-center p-6">
							<Empty>
								<EmptyHeader>
									<EmptyTitle>{t("error.load")}</EmptyTitle>
									<EmptyDescription>{state.message}</EmptyDescription>
								</EmptyHeader>
							</Empty>
						</div>
					) : state.status === "ready" && clip !== undefined ? (
						<Stage
							document={state.document}
							clip={clip}
							timeMs={timeMs}
							atlasImages={state.atlasImages}
							zoom={zoom}
							showGuides={guides}
						/>
					) : (
						<div className="flex size-full items-center justify-center">
							<Skeleton className="size-1/2" />
						</div>
					)}
				</div>

				<footer className="flex flex-col gap-2 border-border border-t px-3 py-2">
					<Slider
						value={[Math.round(timeMs)]}
						min={0}
						max={Math.max(1, Math.round(duration))}
						step={1}
						onValueChange={(value) => {
							setPlaying(false)
							setTimeMs(firstNumber(value, 0))
						}}
						aria-label={t("controls.timeline")}
					/>
					<div className="flex flex-wrap items-center gap-4">
						<span className="text-muted-foreground text-xs">
							{clip === undefined
								? "—"
								: t("controls.frame", {
										frame: frameIndex(
											timeMs,
											clip.sampleRate,
											clipFrameTotal(clip),
										),
										total: clipFrameTotal(clip) - 1,
										ms: Math.round(timeMs),
									})}
						</span>
						<Label className="flex items-center gap-2 text-xs">
							{t("controls.speed")}
							<Slider
								className="w-32"
								value={[speed]}
								min={0.25}
								max={2}
								step={0.05}
								onValueChange={(value) => setSpeed(firstNumber(value, 1))}
								aria-label={t("controls.speed")}
							/>
						</Label>
						<Label className="flex items-center gap-2 text-xs">
							<Icon icon={Maximize} size="sm" />
							{t("controls.zoom")}
							<Slider
								className="w-28"
								value={[zoom]}
								min={0.25}
								max={3}
								step={0.05}
								onValueChange={(value) => setZoom(firstNumber(value, 1))}
								aria-label={t("controls.zoom")}
							/>
						</Label>
						<Label className="flex items-center gap-2 text-xs">
							<Switch
								size="sm"
								checked={loop}
								onCheckedChange={setLoop}
								aria-label={t("controls.loop")}
							/>
							{t("controls.loop")}
						</Label>
						<Label className="flex items-center gap-2 text-xs">
							<Switch
								size="sm"
								checked={guides}
								onCheckedChange={setGuides}
								aria-label={t("controls.guides")}
							/>
							{t("controls.guides")}
						</Label>
						<span className="text-muted-foreground text-xs">
							{t("controls.layers", {
								count:
									clip === undefined
										? 0
										: layersAt(document as CharacterDocument, clip, timeMs)
												.length,
							})}
						</span>
					</div>
				</footer>
			</main>

			<aside className="flex w-panel min-w-0 flex-col border-border border-l">
				{state.status === "ready" ? (
					<AudioPanel
						sounds={state.document.sounds}
						clip={clip ?? (state.document.clips.at(0) as Clip)}
						frame={
							clip === undefined
								? 0
								: frameIndex(timeMs, clip.sampleRate, clipFrameTotal(clip))
						}
						audioMap={state.audioMap}
						enabled={audioEnabled}
						onEnabled={setAudioEnabled}
						onPlayFile={playFile}
					/>
				) : (
					<div className="flex flex-col gap-2 p-3">
						<Skeleton className="h-control w-full" />
						<Skeleton className="h-control w-full" />
						<Skeleton className="h-control w-2/3" />
					</div>
				)}
				{state.status === "ready" ? (
					<>
						<Separator />
						<div className="flex flex-col gap-1 px-3 py-2">
							<SectionLabel>
								<Icon icon={Layers} size="sm" className="mr-1" />
								{t("stats.sprites")}
							</SectionLabel>
							<p className="text-muted-foreground text-xs">
								{t("stats.spriteList", {
									count: clip === undefined ? 0 : clipSpriteNames(clip).length,
									first:
										clip === undefined
											? "—"
											: (clipSpriteNames(clip).at(0) ?? "—"),
								})}
							</p>
							<p className="text-muted-foreground text-xs">
								{t("stats.source", { bundle: state.document.sourceBundle })}
							</p>
						</div>
					</>
				) : null}
			</aside>
		</div>
	)
}
