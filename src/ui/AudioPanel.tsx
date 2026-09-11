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
import { ScrollArea } from "@hoardodile/ui/components/scroll-area"
import { SectionLabel } from "@hoardodile/ui/components/section-label"
import { Separator } from "@hoardodile/ui/components/separator"
import { Switch } from "@hoardodile/ui/components/switch"
import { MusicNotes, Pause, Play } from "@hoardodile/ui/icons/registry"

import type { AudioMap } from "../boundary/documents"
import { useTranslation } from "../i18n"
import { eventsAtFrame } from "../kernel"
import type { Clip, SoundEvent } from "../kernel/types"

export type AudioPanelProps = {
	readonly sounds: readonly SoundEvent[]
	readonly clip: Clip
	readonly frame: number
	readonly audioMap: AudioMap
	readonly enabled: boolean
	readonly onEnabled: (enabled: boolean) => void
	readonly onPlayFile: (file: string, volume: number) => void
}

const summarize = (
	audioMap: AudioMap,
): { resolved: number; total: number } => ({
	resolved: audioMap.filter((entry) => entry.file !== null).length,
	total: audioMap.length,
})

export function AudioPanel({
	sounds,
	clip,
	frame,
	audioMap,
	enabled,
	onEnabled,
	onPlayFile,
}: AudioPanelProps) {
	const { t } = useTranslation()
	const summary = summarize(audioMap)
	const fileForEvent = (event: string): string | null =>
		audioMap.find((entry) => entry.event === event)?.file ?? null
	const soundsForClip = sounds.filter((sound) => sound.name === clip.name)
	const due = eventsAtFrame(soundsForClip, frame)

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between gap-2 px-3 py-2">
				<SectionLabel>{t("audio.title")}</SectionLabel>
				<div className="flex items-center gap-2">
					<Badge variant={summary.resolved > 0 ? "secondary" : "outline"}>
						{t("audio.resolved", {
							resolved: summary.resolved,
							total: summary.total,
						})}
					</Badge>
					<Label className="flex items-center gap-2 text-xs">
						<Switch
							size="sm"
							checked={enabled}
							onCheckedChange={(checked) => onEnabled(checked)}
							aria-label={t("audio.enable")}
						/>
						{t("audio.enable")}
					</Label>
				</div>
			</div>
			<Separator />
			<div className="px-3 py-2">
				<p className="text-muted-foreground text-xs">
					{t("audio.frameHint", { frame })}
				</p>
			</div>
			<ScrollArea className="min-h-0 flex-1">
				<div className="flex flex-col gap-2 p-3">
					{due.length === 0 ? (
						<p className="text-muted-foreground text-xs">
							{t("audio.noneAtFrame")}
						</p>
					) : (
						due.map((entry, index) => {
							const file = fileForEvent(entry.event)
							return (
								<div
									key={`${entry.sound}-${entry.frame}-${index}`}
									className="flex flex-col gap-1"
								>
									<div className="flex items-center justify-between gap-2">
										<span className="truncate text-xs">{entry.sound}</span>
										<div className="flex items-center gap-1">
											{entry.volume === 1 ? null : (
												<Badge variant="outline">
													{`x${entry.volume.toFixed(2)}`}
												</Badge>
											)}
											<Badge variant="outline">
												{t("audio.frame", { frame: entry.frame })}
											</Badge>
										</div>
									</div>
									<Button
										size="sm"
										variant="outline"
										disabled={file === null}
										className="justify-start"
										onClick={() =>
											file === null ? undefined : onPlayFile(file, entry.volume)
										}
									>
										<Icon
											icon={file === null ? Pause : Play}
											size="sm"
											data-icon="inline-start"
										/>
										<span className="truncate">{entry.event}</span>
									</Button>
								</div>
							)
						})
					)}
					<Separator />
					<SectionLabel>{t("audio.eventMap")}</SectionLabel>
					{audioMap.length === 0 ? (
						<Empty>
							<EmptyHeader>
								<EmptyTitle>{t("audio.noMap")}</EmptyTitle>
								<EmptyDescription>{t("audio.noMapHint")}</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						audioMap.map((entry) => (
							<div
								key={entry.event}
								className="flex items-center justify-between gap-2"
							>
								<span className="truncate text-xs" title={entry.event}>
									<Icon icon={MusicNotes} size="sm" className="mr-1" />
									{entry.event}
								</span>
								<Badge variant={entry.file === null ? "outline" : "secondary"}>
									{entry.match}
								</Badge>
							</div>
						))
					)}
				</div>
			</ScrollArea>
		</div>
	)
}
