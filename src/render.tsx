import "./index.css"

import { createPluginRoot } from "@hoardodile/sdk-react"
import { PluginAPIProvider } from "./hooks"
import { CharacterView } from "./ui/CharacterView"

createPluginRoot({ provider: PluginAPIProvider, render: CharacterView })
