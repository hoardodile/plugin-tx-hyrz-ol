import { describe, expect, it } from "vitest"
import de from "../locales/de"
import en from "../locales/en"
import es from "../locales/es"
import ja from "../locales/ja"
import zh from "../locales/zh"

const BUNDLES: Record<string, Record<string, unknown>> = {
	en: en as unknown as Record<string, unknown>,
	zh: zh as unknown as Record<string, unknown>,
	ja: ja as unknown as Record<string, unknown>,
	de: de as unknown as Record<string, unknown>,
	es: es as unknown as Record<string, unknown>,
}

function flatten(
	obj: Record<string, unknown>,
	path: string[] = [],
	out: { key: string; value: string }[] = [],
): { key: string; value: string }[] {
	for (const [k, v] of Object.entries(obj)) {
		if (typeof v === "object" && v !== null) {
			flatten(v as Record<string, unknown>, [...path, k], out)
		} else {
			out.push({ key: [...path, k].join("."), value: String(v) })
		}
	}
	return out
}

function vars(value: string): string {
	return (value.match(/\{\{[^}]+\}\}/g) ?? [])
		.map((m) => m.slice(2, -2))
		.sort()
		.join(",")
}

/** i18next plural forms: `key_zero` / `key_one` / `key_two` / `key_few` / `key_many` / `key_other`. */
const PLURAL_SUFFIXES = [
	"_zero",
	"_one",
	"_two",
	"_few",
	"_many",
	"_other",
] as const

function isPluralKey(key: string): boolean {
	return PLURAL_SUFFIXES.some((suffix) => key.endsWith(suffix))
}

describe("plugin locale parity", () => {
	const enFlat = flatten(BUNDLES.en!)
	const enKeys = new Set(enFlat.map((r) => r.key))

	it("ships every hoardodile-supported language", () => {
		expect(Object.keys(BUNDLES).sort()).toEqual(["de", "en", "es", "ja", "zh"])
	})

	it("has identical flat key sets across all bundles", () => {
		for (const [lang, bundle] of Object.entries(BUNDLES)) {
			const flat = flatten(bundle)
			const keys = new Set(flat.map((r) => r.key))
			expect(
				[...enKeys].filter((k) => !keys.has(k)),
				`keys only in en`,
			).toEqual([])
			expect(
				[...keys].filter((k) => !enKeys.has(k)),
				`keys only in ${lang}`,
			).toEqual([])
		}
	})

	it("uses the same interpolation placeholders per key", () => {
		for (const [lang, bundle] of Object.entries(BUNDLES)) {
			const byKey = new Map(flatten(bundle).map((r) => [r.key, r.value]))
			const mismatched: string[] = []
			for (const { key, value } of enFlat) {
				const other = byKey.get(key)
				if (other !== undefined && vars(value) !== vars(other)) {
					mismatched.push(key)
				}
			}
			expect(mismatched, `placeholder mismatch in ${lang}`).toEqual([])
		}
	})

	it("never ships untranslated English source copy", () => {
		const english = new Map(enFlat.map((r) => [r.key, r.value]))
		for (const [lang, bundle] of Object.entries(BUNDLES)) {
			if (lang === "en") continue
			const untranslated: string[] = []
			for (const { key, value } of flatten(bundle)) {
				// A plural form the language does not distinguish (zh/ja have a
				// single form, so i18next reads `_one` and `_other` alike) is
				// legitimately identical to English; the host catalogs ship the
				// same shape. Only non-plural copy must differ.
				if (isPluralKey(key)) continue
				if (value === english.get(key)) untranslated.push(key)
			}
			expect(untranslated, `untranslated keys in ${lang}`).toEqual([])
		}
	})

	it("ships a plural form for every language that needs one", () => {
		// i18next resolves `key_one`/`key_other` through Intl.PluralRules; a
		// language that needs `_one` and ships only `_other` would silently
		// render the plural in the singular case.
		const plural = enFlat.filter((row) => isPluralKey(row.key))
		expect(plural.length).toBeGreaterThan(0)
		for (const [lang, bundle] of Object.entries(BUNDLES)) {
			const keys = new Set(flatten(bundle).map((row) => row.key))
			const required = plural.filter((row) => {
				const one = row.key.endsWith("_one")
				const categories = new Intl.PluralRules(lang).resolvedOptions()
					.pluralCategories
				return one ? categories.includes("one") : categories.includes("other")
			})
			const missing = required
				.filter((row) => !keys.has(row.key))
				.map((row) => row.key)
			expect(missing, `missing plural forms in ${lang}`).toEqual([])
		}
	})
})
