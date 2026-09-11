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
- **Preview (default)**: every action of the character plays at once, one tile per
  action, no setup required. Each tile is sized to its own full-frame bounds and
  shown at **1:1 — one art pixel per device pixel, never scaled up or down**; tiles
  wrap in a flex row, so differently sized actions each get their own space and the
  panel scrolls when they do not fit. Preview is silent — it never loads the audio
  map and has no playback path at all.
- **Inspect**: a dense action table (search, category filters, frames / milliseconds
  / sound-event count per row), a stage at **native 1:1** that frames a whole
  animation into the canvas instead of cropping it, a **frame strip** of real frame
  thumbnails to scrub, and the **Loop, Next action and Sound switches, one per row**,
  at the top of the right panel, followed by the current frame: the drawn layers
  (layer, sprite, position, scale, rotation), the sounds firing on that frame, and
  the sprite/atlas details, with the event map behind a dialog. **Next action** plays
  one action, then moves straight on to the next one in the list (wrapping at the
  end); it turns Loop off and greys its switch out, because a looping clock never
  reaches the end of an action. Both side panels follow the viewport (the action
  table from 1150 px, the frame panel from 1440 px).
- **Settings are remembered**: which view is open and the three inspect switches are
  plugin **preferences**, written to the host's preference store — a fresh install
  opens on the preview, and every later visit lands where the user left off, across
  reloads, characters and collections.
- **Bottom control bar (identical in both views)**: play/pause, restart, a live
  readout (the action count in preview, `frame N / M · ms` in inspect), and the view
  switch at the far right; a collection resource adds a searchable character picker.
  There is no zoom, speed or frame-step control — frames play at the exported pixel
  size and frame rate.
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
