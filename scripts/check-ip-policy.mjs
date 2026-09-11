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
 * What must not appear, and why.
 *
 * Every pattern anchors on a *leading* word boundary only. A banned stem also
 * shows up inside a longer identifier (`UNITY_PIXELS_PER_UNIT`,
 * `FMOD_EVENT_BANK`, `spineVersion`), and requiring a trailing boundary is
 * exactly the hole that let one through — the leading `\b` is enough, because
 * none of these stems begins an unrelated English word at a word start that
 * matters ("community" has no boundary before `unity`).
 *
 * `matches` is the self-test sample: a pattern that cannot match its own sample
 * is a pattern that silently never fires, so `SELF_TEST` asserts every one.
 */
const TERMS = [
	{
		id: "game-title",
		reason: "the game's title (any language)",
		pattern: /火影|忍者|naruto/i,
		matches: ["火影忍者", "Naruto OL"],
	},
	{
		id: "game-package",
		reason: "the game's application id",
		pattern: /com[._-]tencent|hyrzol/i,
		matches: ["com.tencent.hyrzol", "com_tencent_app"],
	},
	{
		id: "publisher",
		reason: "the publisher's name",
		pattern: /\btencent/i,
		matches: ["Tencent Games", "TENCENT_CLOUD"],
	},
	{
		id: "package-name",
		reason: "this repository's own name (the one accepted exception)",
		pattern: /\bhyrz|plugin-tx-hyrz-ol/i,
		matches: ["plugin-tx-hyrz-ol", "hyrz-ol-unpack"],
	},
	{
		id: "engine",
		reason: "the engine that produced the payload",
		pattern: /\bunity|\bmonobehaviour/i,
		matches: [
			"UnityFS",
			"UnityPy",
			"UNITY_PIXELS_PER_UNIT",
			"unity_pixels_per_unit",
			"MonoBehaviour",
		],
	},
	{
		id: "middleware",
		reason: "the audio middleware that produced the payload",
		pattern: /\bfmod|\bfsb5/i,
		matches: ["FMOD_EVENT", "fmod_bank", "FSB5"],
	},
	{
		id: "rig-format",
		reason: "the skeletal-animation product name",
		// Not `skel`: as a bare word it collides with the UI package's
		// `--animate-skel*` custom properties, which have nothing to do with it.
		pattern: /\bspine|\bspindle/i,
		matches: ["spineVersion", "Spine folders", "spindle"],
	},
	{
		id: "source-identifiers",
		reason: "identifiers copied out of the source data",
		// The exporter's internal stems. Examples and fixtures must be invented.
		pattern: /\bassetbundles|\bninjaimage|\bninja|\b1nrt|\b1nrs|\bmasterdata/i,
		matches: [
			"assetbundles/battle",
			"ninjaimage_1001",
			"ninja_11000111",
			"1nrtbody0_0000",
			"1nrsbody0_0000",
			"masterdata",
		],
	},
	{
		id: "resource-id",
		reason:
			"a resource id from the source data (use an invented id like test0001)",
		// Exported ids are eight-digit numbers starting with 1. The leading guard
		// is `[^\d]` rather than `\b` on purpose: ids show up glued to an
		// underscore (`ninja_11000111`), where `\b` would never fire. No
		// legitimate example needs one; if this trips on a real number, rewrite it.
		pattern: /(?:^|[^\d])1\d{7}(?!\d)/,
		matches: [
			'"id": "11000111"',
			"characters/14002440/",
			'"sourceBundle": "bundles/x_11000111"',
		],
	},
]

/** Text that must stay legal, so the patterns above are not over-eager. */
const ALLOWED_TEXT = [
	'import { community } from "./community"',
	"// a photo opportunity: unifying the two paths",
	'"id": "test0001"',
	'"version": 2021.3, "width": 1024, "bytes": 1048576',
	'"maxClipMs": 3100, "frameCount": 50, "sprites": 150',
	'"run": "110001112"',
	"event:/sfx/demo/hit_01",
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

/**
 * Guard the patterns themselves.
 *
 * A regex that never fires is worse than no gate: it reports success while the
 * text it was meant to stop ships anyway. So every term must match its samples,
 * and no term may match `ALLOWED_TEXT`.
 */
const selfTest = () => {
	const failures = []
	for (const term of TERMS) {
		if (!Array.isArray(term.matches) || term.matches.length === 0) {
			failures.push(`[${term.id}] has no self-test sample`)
			continue
		}
		for (const sample of term.matches) {
			if (!term.pattern.test(sample)) {
				failures.push(`[${term.id}] does not match its own sample: ${sample}`)
			}
		}
	}
	for (const line of ALLOWED_TEXT) {
		for (const term of TERMS) {
			if (term.pattern.test(line)) {
				failures.push(`[${term.id}] false positive on: ${line}`)
			}
		}
	}
	return failures
}

const selfTestFailures = selfTest()
if (selfTestFailures.length > 0) {
	console.error("ip policy: the gate itself is broken\n")
	for (const failure of selfTestFailures) console.error(`  ${failure}`)
	process.exit(1)
}

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
	`ip policy: ok (${scanned} files, no game/publisher/engine/middleware names or source identifiers)`,
)
