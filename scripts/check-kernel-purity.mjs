/**
 * Strict functional-purity gate for `src/kernel/**`.
 *
 * The kernel is a total function of its inputs: no rebinding, no loops, no
 * classes, no `this`, no `throw`, no ambient time or randomness, and no IO. The
 * boundary (`src/boundary/**`) and the React layer (`src/ui/**`) are where
 * impurity lives — through Effect, and through readonly types.
 *
 * Why a script and not ESLint: this repo pins TypeScript 7 (the native
 * compiler), and neither `typescript-eslint` nor `eslint-plugin-functional`
 * (via `ts-api-utils`) can load against it — both fail at import time. Biome
 * stays the formatter/linter for everything else (`biome.json` carries extra
 * kernel rules via `overrides`); this script adds the syntax bans Biome cannot
 * express.
 *
 * Usage: `node scripts/check-kernel-purity.mjs` (wired into `pnpm lint`).
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const kernelDir = join(root, "src", "kernel")

const BANS = [
	{
		pattern: /\blet\s+[A-Za-z_$]/,
		message: "use `const` — the kernel never rebinds",
	},
	{
		pattern: /\bvar\s+[A-Za-z_$]/,
		message: "use `const` — `var` has no place in a pure function",
	},
	{
		pattern: /\bfor\s*\(/,
		message: "use map/filter/reduce/flatMap instead of loops",
	},
	{
		pattern: /\bfor\s+(await\s+)?[A-Za-z_$][\w$]*\s+(of|in)\b/,
		message: "use map/reduce instead of loops",
	},
	{
		pattern: /\bwhile\s*\(/,
		message: "use recursion or a reducer instead of a loop",
	},
	{
		pattern: /\bdo\s*\{/,
		message: "use recursion or a reducer instead of a loop",
	},
	{
		pattern: /\bclass\s+[A-Za-z_$]/,
		message: "use plain data and functions, not classes",
	},
	{ pattern: /\bthis\b/, message: "no `this` — pass the data in" },
	{
		pattern: /\bthrow\b/,
		message: "return a value (Result) instead of throwing",
	},
	{
		pattern: /\bawait\b/,
		message: "async work belongs in the boundary (Effect)",
	},
	{
		pattern: /\bnew\s+Date\b/,
		message: "time is an input, not an ambient dependency",
	},
	{
		pattern: /\bDate\.now\s*\(/,
		message: "time is an input, not an ambient dependency",
	},
	{
		pattern: /\bMath\.random\s*\(/,
		message: "randomness is an input, not an ambient dependency",
	},
	{ pattern: /\bfetch\s*\(/, message: "IO belongs in the boundary" },
	{ pattern: /\bnew\s+Image\b/, message: "IO belongs in the boundary" },
	{
		pattern:
			/\bdocument\.(getElementById|querySelector|querySelectorAll|createElement|addEventListener|body)\b/,
		message: "DOM access belongs in the UI layer",
	},
	{ pattern: /\bwindow\./, message: "DOM access belongs in the UI layer" },
	{
		pattern: /\bglobalThis\b/,
		message: "the kernel takes everything it needs as arguments",
	},
	{ pattern: /\bconsole\./, message: "logging belongs in the boundary" },
]

/**
 * Remove comments and string/template literals so a banned word inside prose or
 * a message string never trips the gate.
 */
const stripLiterals = (source) =>
	source
		.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
		.replace(/\/\/[^\n]*/g, "")
		.replace(/`(?:\\.|[^`\\])*`/g, '""')
		.replace(/'(?:\\.|[^'\\\n])*'/g, '""')
		.replace(/"(?:\\.|[^"\\\n])*"/g, '""')

const walk = (directory) =>
	readdirSync(directory)
		.flatMap((entry) => {
			const path = join(directory, entry)
			return statSync(path).isDirectory() ? walk(path) : [path]
		})
		.filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"))

const offenders = []
for (const path of walk(kernelDir)) {
	const source = stripLiterals(readFileSync(path, "utf8"))
	const lines = source.split("\n")
	lines.forEach((line, index) => {
		for (const ban of BANS) {
			if (ban.pattern.test(line)) {
				offenders.push({
					file: relative(root, path),
					line: index + 1,
					message: ban.message,
					text: line.trim().slice(0, 100),
				})
			}
		}
	})
}

if (offenders.length > 0) {
	console.error(`kernel purity: ${offenders.length} violation(s)\n`)
	for (const offender of offenders) {
		console.error(`  ${offender.file}:${offender.line}  ${offender.message}`)
		console.error(`      ${offender.text}`)
	}
	process.exit(1)
}

console.log(
	"kernel purity: ok (no let/loops/classes/this/throw/await/ambient IO)",
)
