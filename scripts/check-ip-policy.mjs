/**
 * IP-policy gate: this repository must ship no third-party content.
 *
 * The plugin is a *viewer* for an export format. Nothing in it needs to name the
 * game it was first written against, its publisher, or the engine and middleware
 * that produced the payload — and public text that names them is a licensing
 * risk regardless of the code being clean. So the names are banned outright and
 * this gate enforces it over every text file the repo ships.
 *
 * The gate has to spell those names out to ban them, so it exempts itself; that
 * is the only file-level blanket exemption.
 *
 * One more risk is accepted knowingly: the repository/package name carries an
 * abbreviation of the game title. It is the single `ALLOWED` entry below and may
 * appear nowhere else.
 *
 * Usage: `node scripts/check-ip-policy.mjs` (wired into `pnpm lint`).
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

/** Directories that are generated, vendored or not shipped. */
const SKIP_DIRS = new Set([
	"node_modules",
	"dist",
	".git",
	".hoardodile",
	"unpacked",
	"release",
	"coverage",
])

const TEXT_EXTENSIONS = [
	".md",
	".ts",
	".tsx",
	".mts",
	".cts",
	".js",
	".mjs",
	".cjs",
	".json",
	".jsonc",
	".html",
	".css",
	".yml",
	".yaml",
	".toml",
	".txt",
	".svg",
]

/**
 * What must not appear, and why. Patterns are case-insensitive and word-bounded
 * where the bare word would be ambiguous.
 */
const TERMS = [
	{
		id: "game-title",
		reason: "the game's title (any language)",
		pattern: /火影|忍者|naruto/i,
	},
	{
		id: "game-package",
		reason: "the game's application id",
		pattern: /com[._-]tencent|hyrzol/i,
	},
	{
		id: "publisher",
		reason: "the publisher's name",
		pattern: /\btencent\b/i,
	},
	{
		id: "package-name",
		reason: "this repository's own name (the one accepted exception)",
		pattern: /\bhyrz\b|plugin-tx-hyrz-ol/i,
	},
	{
		id: "engine",
		reason: "the engine that produced the payload",
		pattern: /\bunity(?:py|fs|khnfs|khfs)?\b|\bmonobehaviour\b/i,
	},
	{
		id: "middleware",
		reason: "the audio middleware that produced the payload",
		pattern: /\bfmod\b|\bfsb5\b/i,
	},
	{
		id: "rig-format",
		reason: "the skeletal-animation product name",
		// Not `skel`: as a bare word it collides with the UI package's
		// `--animate-skel*` custom properties, which have nothing to do with it.
		pattern: /\bspine\b|\bspindle\b/i,
	},
]

/**
 * Files that may contain the banned names because forbidding them is their job.
 */
const EXEMPT_FILES = new Set(["scripts/check-ip-policy.mjs"])

/**
 * The only tolerated occurrences: `(term id, file)` pairs. The repository and
 * package name has to exist somewhere, and it is repeated in the lockfile
 * importer; nothing else is exempt.
 */
const ALLOWED = [
	{ term: "package-name", file: "package.json" },
	{ term: "package-name", file: "pnpm-lock.yaml" },
]

const allowedFor = (term, file) =>
	EXEMPT_FILES.has(file) ||
	ALLOWED.some((entry) => entry.term === term && entry.file === file)

const walk = (directory) =>
	readdirSync(directory).flatMap((entry) => {
		if (SKIP_DIRS.has(entry)) return []
		const path = join(directory, entry)
		if (statSync(path).isDirectory()) return walk(path)
		return TEXT_EXTENSIONS.some((extension) => path.endsWith(extension))
			? [path]
			: []
	})

const offenders = []
let scanned = 0
for (const path of walk(root)) {
	const file = relative(root, path).replaceAll("\\", "/")
	const lines = readFileSync(path, "utf8").split("\n")
	scanned += 1
	lines.forEach((line, index) => {
		for (const term of TERMS) {
			if (!term.pattern.test(line)) continue
			if (allowedFor(term.id, file)) continue
			offenders.push({
				file,
				line: index + 1,
				term,
				text: line.trim().slice(0, 120),
			})
		}
	})
}

if (offenders.length > 0) {
	console.error(`ip policy: ${offenders.length} disallowed mention(s)\n`)
	for (const offender of offenders) {
		console.error(
			`  ${offender.file}:${offender.line}  [${offender.term.id}] ${offender.term.reason}`,
		)
		console.error(`      ${offender.text}`)
	}
	console.error(
		"\nRewrite the text, or add a `(term id, file)` pair to ALLOWED with a reason.",
	)
	process.exit(1)
}

console.log(
	`ip policy: ok (${scanned} files, no game/publisher/engine/middleware names)`,
)
