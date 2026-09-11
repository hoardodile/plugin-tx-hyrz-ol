import { IconToggle } from "@hoardodile/ui/components/icon-toggle"
import { Gallery, Structure } from "@hoardodile/ui/icons/registry"

import { useTranslation } from "../i18n"

/** Which view the resource is showing. */
export type ViewMode = "preview" | "inspect"

export type ModeToggleProps = {
	readonly value: ViewMode
	readonly onChange: (mode: ViewMode) => void
}

/**
 * The one control that swaps the whole surface, shared by both views' control
 * bars so it always sits in the same place: the right end of the bottom row.
 */
export function ModeToggle({ value, onChange }: ModeToggleProps) {
	const { t } = useTranslation()

	return (
		<IconToggle
			value={value}
			onChange={onChange}
			options={[
				{ value: "preview", icon: Gallery, label: t("mode.preview") },
				{ value: "inspect", icon: Structure, label: t("mode.inspect") },
			]}
		/>
	)
}
