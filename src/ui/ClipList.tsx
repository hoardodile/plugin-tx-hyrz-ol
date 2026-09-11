import { Badge } from "@hoardodile/ui/components/badge"
import { Button } from "@hoardodile/ui/components/button"
import { ScrollArea } from "@hoardodile/ui/components/scroll-area"
import { SectionLabel } from "@hoardodile/ui/components/section-label"
import { useTranslation } from "../i18n"
import { clipFrameTotal, clipsByCategory } from "../kernel"
import type { Clip } from "../kernel/types"

export type ClipListProps = {
	readonly clips: readonly Clip[]
	readonly value: string
	readonly onChange: (name: string) => void
}

export function ClipList({ clips, value, onChange }: ClipListProps) {
	const { t } = useTranslation()
	const groups = clipsByCategory(clips)

	return (
		<ScrollArea className="h-full">
			<div className="flex flex-col gap-3 p-2">
				{groups.map(([category, items]) => (
					<div key={category} className="flex flex-col gap-1">
						<div className="flex items-center justify-between gap-2 px-1">
							<SectionLabel>{t(`category.${category}`)}</SectionLabel>
							<Badge variant="secondary">{items.length}</Badge>
						</div>
						{items.map((clip) => (
							<Button
								key={clip.name}
								size="sm"
								variant={clip.name === value ? "secondary" : "ghost"}
								active={clip.name === value}
								aria-pressed={clip.name === value}
								className="justify-between"
								onClick={() => onChange(clip.name)}
							>
								<span className="truncate">{clip.name}</span>
								<span className="text-muted-foreground text-xs">
									{clipFrameTotal(clip)}
								</span>
							</Button>
						))}
					</div>
				))}
			</div>
		</ScrollArea>
	)
}
