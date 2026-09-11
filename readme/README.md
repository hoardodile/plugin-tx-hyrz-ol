# Character Frame Animation — sprite frame-animation viewer

Plays an **exported 2D character folder** in hoardodile: frame-accurate sprite
animation, action switching, and the per-frame character audio the export carries.

A character is a 2D sprite animation — five draw layers with sprite-swap curves
plus position/scale/rotation, 30 fps, on the order of 150 sprites and 75 actions.
The export format is documented in `docs/format.md`; the exporter itself is a
separate, private producer, not part of this repository.

## Features

- Detects two resource shapes: one **self-contained character folder**
  (`character.json` at its root — keep or delete folders individually) and a
  **collection root** (`catalog.json`, with a character picker).
- Viewer: action list grouped by idle/movement/attack/skill/damage/state, a canvas
  frame player (play/pause, frame step, restart, speed, zoom, loop, guides, timeline),
  plus the current frame and drawn layer count.
- Character audio: the sound events the export fires per frame, with the exported
  gain restored (gains above 1.0 show an `x0.80` badge), playable when they resolve
  to a sample, plus the full event→sample status (unresolved ones are shown rather
  than hidden).
- Card: `cover.png` as the cover, localized corner copy via manifest i18n keys.
- Permissions: `sourceMeta` only.

## Requirements

- hoardodile ≥ 0.2.0.
- An exported character folder or collection. Nothing is bundled with the plugin.
- Trust the repository before installing: plugin code runs server-side in a
  restricted sandbox.
