import { definePluginAPI } from "@hoardodile/sdk-react"
import type { FrameSchema } from "./shared"

export const { PluginAPIProvider, usePluginAPI } =
	definePluginAPI<FrameSchema>()
