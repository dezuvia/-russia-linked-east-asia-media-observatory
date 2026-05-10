import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type KeywordTranslation = {
  termZh: string;
  termEn: string;
  source?: string;
  updatedAt?: string;
};

export type KeywordTranslationCache = {
  schemaVersion: "keyword-translations-v1";
  updatedAt: string | null;
  entries: Record<string, KeywordTranslation>;
};

const DEFAULT_CACHE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "keyword-translations.json"
);

export function keywordTranslationCachePath() {
  return process.env.KEYWORD_TRANSLATION_CACHE_PATH ?? DEFAULT_CACHE_PATH;
}

export function emptyKeywordTranslationCache(): KeywordTranslationCache {
  return {
    schemaVersion: "keyword-translations-v1",
    updatedAt: null,
    entries: {}
  };
}

export function loadKeywordTranslationCache(
  path = keywordTranslationCachePath()
): KeywordTranslationCache {
  if (!existsSync(path)) {
    return emptyKeywordTranslationCache();
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<KeywordTranslationCache>;
  return {
    schemaVersion: "keyword-translations-v1",
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    entries: normalizeEntries(parsed.entries)
  };
}

export function saveKeywordTranslationCache(
  cache: KeywordTranslationCache,
  path = keywordTranslationCachePath()
) {
  const sorted: KeywordTranslationCache = {
    schemaVersion: "keyword-translations-v1",
    updatedAt: cache.updatedAt,
    entries: Object.fromEntries(
      Object.entries(cache.entries).sort(([left], [right]) => left.localeCompare(right))
    )
  };
  writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
}

export function bilingualKeywordTerms(
  terms: string[],
  cache: KeywordTranslationCache
): { keywordTermsZh: string[]; keywordTermsEn: string[] } {
  const keywordTermsZh: string[] = [];
  const keywordTermsEn: string[] = [];

  for (const term of terms) {
    const cleaned = cleanTerm(term);
    if (!cleaned) {
      continue;
    }
    const translation = cache.entries[cleaned];
    keywordTermsZh.push(translation?.termZh || cleaned);
    keywordTermsEn.push(translation?.termEn || cleaned);
  }

  return { keywordTermsZh, keywordTermsEn };
}

export function cleanTerm(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeEntries(entries: unknown): Record<string, KeywordTranslation> {
  if (!isRecord(entries)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(entries).flatMap(([term, value]) => {
      if (!isRecord(value)) {
        return [];
      }
      const cleanedTerm = cleanTerm(term);
      const termZh = cleanTerm(value.termZh);
      const termEn = cleanTerm(value.termEn);
      if (!cleanedTerm || !termZh || !termEn) {
        return [];
      }
      return [[cleanedTerm, {
        termZh,
        termEn,
        source: cleanTerm(value.source) || undefined,
        updatedAt: cleanTerm(value.updatedAt) || undefined
      }]];
    })
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
