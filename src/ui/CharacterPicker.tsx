import { Badge } from "@hoardodile/ui/components/badge"
import { Button } from "@hoardodile/ui/components/button"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@hoardodile/ui/components/popover"
import { ScrollArea } from "@hoardodile/ui/components/scroll-area"
import { SearchField } from "@hoardodile/ui/components/search-field"
import { useMemo, useState } from "react"

import type { CatalogDocument } from "../boundary/documents"
import { useTranslation } from "../i18n"

export type CharacterPickerProps = {
	readonly catalog: CatalogDocument
	readonly selectedId: string | null
	readonly onSelect: (id: string) => void
}

/**
 * Which character a collection resource is showing.
 *
 * A collection can hold hundreds of characters, so the picker is a popover with
 * a search field rather than a row of buttons in the chrome: the control bar
 * keeps its transport, the current name, and this trigger.
 */
export function CharacterPicker({
	catalog,
	selectedId,
	onSelect,
}: CharacterPickerProps) {
	const { t } = useTranslation()
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState("")

	const current = catalog.characters.find((entry) => entry.id === selectedId)
	const rows = useMemo(
		() =>
			catalog.characters.filter((entry) =>
				query.length === 0
					? true
					: `${entry.id} ${entry.name ?? ""}`
							.toLowerCase()
							.includes(query.toLowerCase()),
			),
		[catalog, query],
	)

	return (
		<Popover open={open} onOpenChange={setOpen} closeOnBlur>
			<PopoverTrigger
				render={
					<Button
						size="sm"
						variant="outline"
						aria-label={t("picker.chooseCharacter")}
					/>
				}
			>
				<span className="max-w-40 truncate">
					{current?.name ?? selectedId ?? t("picker.chooseCharacter")}
				</span>
				<Badge variant="secondary" className="ml-2">
					{catalog.characters.length}
				</Badge>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-72 p-2">
				<div className="flex flex-col gap-2">
					<SearchField
						value={query}
						onCommit={setQuery}
						placeholder={t("picker.searchCharacters")}
					/>
					<ScrollArea className="max-h-72">
						<div className="flex flex-col gap-0.5">
							{rows.map((entry) => (
								<Button
									key={entry.id}
									size="sm"
									variant={entry.id === selectedId ? "secondary" : "ghost"}
									active={entry.id === selectedId}
									className="justify-start"
									onClick={() => {
										onSelect(entry.id)
										setOpen(false)
									}}
								>
									<span className="truncate">{entry.name ?? entry.id}</span>
								</Button>
							))}
						</div>
					</ScrollArea>
				</div>
			</PopoverContent>
		</Popover>
	)
}
