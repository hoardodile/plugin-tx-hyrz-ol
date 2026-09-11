# AGENTS.md

## What this repo is

A hoardodile content plugin that plays an **exported 2D sprite-frame character**:
`detect` → `sourceMeta` → sandboxed iframe render, plus per-frame audio.

**Hard constraint:** this repository is public and must carry no third-party
content. No game/character names, no publisher, no engine or middleware product
names, no reverse-engineering detail — anywhere, including comments, docs, i18n
strings and fixtures. `scripts/check-ip-policy.mjs` enforces this and runs in
`pnpm lint`; the only allowlisted occurrence is the repo's own name in
`package.json` and `pnpm-lock.yaml`.

The exporter is a **separate, private** project. Nothing here parses game data;
this repo consumes the format documented in `docs/format.md`.

## Commands

- `pnpm build` — build `dist/` (client + server bundle + manifest).
- `pnpm dev` — watch-build + serve the workbench at http://127.0.0.1:5199 (data from `testdata/`).
- `pnpm dev:data --data <dir> [<id>] [--all|--collection]` — serve a real export
  (`<dir>` is an export root or a `characters/` directory; `FRAME_DATA_ROOT` also works).
  No export ships with the repo, so this needs data from outside.
- `pnpm test` — Vitest. `FRAME_DATA_ROOT=<export root> pnpm test` additionally decodes
  a spread of real `character.json` files.
- `pnpm run detect:smoke` — sandboxed `detect` against `testdata/` (needs a build first).
- `pnpm lint` — `biome check .` + kernel purity + IP policy + `tsc --noEmit`.
- `pnpm format` — `biome check --write`; `pnpm testdata` — regenerate the fixture.
- `pnpm readme:check` — gate the marketplace `readme/` folder; `pnpm release <version>` —
  release-it bumps version, writes `CHANGELOG.md`, tags `v<version>`.

Git hooks (`lefthook.yml`, installed by `postinstall`): `commit-msg` enforces
Conventional Commits; `pre-commit` runs biome + `tsc` on staged files.

## Structure

```
src/kernel/     pure kernel: sampling, atlas math, event scheduling, group lookup
src/boundary/   Effect layer: Schema decode, ResourceAccess, AudioPlayer
src/ui/         React + @hoardodile/ui views and the canvas renderer
src/main.ts     server-side definition (definePlugin): detect + sourceMeta + listFiles
src/shared.ts   FrameSchema typed once, shared server ↔ client
src/hooks.ts    typed plugin API (definePluginAPI) for the client
docs/format.md  the export format this plugin consumes (the published contract)
testdata/       synthetic fixture for `pnpm dev` and unit tests
scripts/        fixture generator, dev launcher, kernel-purity / IP gates
```

## Architecture

- **Kernel is pure.** `src/kernel/**` is a total function of its inputs: no IO, no Dom,
  no Effect, and `scripts/check-kernel-purity.mjs` bans `let`/loops/class/`this`/`throw`/
  `await`/ambient time or randomness there. Impurity lives in `src/boundary/**` (Effect)
  and `src/ui/**` (React + rAF).
- **Decode, never cast.** JSON from disk goes through `Schema` in
  `src/boundary/schema.ts`; a failure is a `Schema.TaggedError`, not `any`.
- **The export labels its own data.** Clip buckets come from `clips[].group`; the viewer
  must not infer them from clip names (the naming convention belongs to the exporter).
  Missing/unknown labels fall back to `other`. Same for provenance: render
  `sourceFormat` and never guess where the payload came from.
- **No runtime clipping.** Atlas pages are repacked fragment-free by the exporter, so a
  draw is one `drawImage`. Do not reintroduce mesh/mask/clip fields.
- **Pixel sharpness** is `pixelExactScale` + `integerSourceRect`: scale snaps to whole
  device pixels, nearest-neighbour at 1:1 and above, interpolation only when
  `deviceScale < 1`.
- **Contract:** `manifest.json` + server `main.js` (`definePlugin`) + sandboxed iframe
  client. `manifest.ui.card`/`.search`/`.message` declare host-rendered `{{...}}`
  templates; the CLI lints them at build time.
- **SDK closure:** plugin code may import only `@hoardodile/{i18n,ui,sdk-*}`; terminal
  packages (`cli`, `host`, `host-web`, `workbench`) are never imported by a plugin.

## Testing

- Layer 1 — Vitest with `createResourceAPIFixture` (in-memory) and the synthetic fixture.
- Layer 2 — `createDirectoryResourceAPI` against real files in a temp dir.
- Layer 3 — `hoardodile plugin run detect testdata --plugin-dir dist`, the exact
  production execution path.
- Layer 4 — `documents.test.ts` decodes real exported documents when
  `FRAME_DATA_ROOT` points at an export.

## Conventions

- Biome: tabs, double quotes, no semicolons. Keep `pnpm format` output as-is.
- TypeScript is pinned to 7.x (native compiler), so `typescript-eslint` and
  `eslint-plugin-functional` cannot load — that is why kernel strictness lives in
  `scripts/check-kernel-purity.mjs` and IP strictness in `scripts/check-ip-policy.mjs`.
- Changing a field name is a **format change**: update `docs/format.md`,
  `src/kernel/types.ts`, `src/boundary/schema.ts`, `scripts/make-testdata.mjs` and the
  private exporter's format-contract test together.
