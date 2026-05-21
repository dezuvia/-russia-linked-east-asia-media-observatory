import type { Language } from "./i18n";
import type { Label } from "./types";

export const CHART_COLORS = [
  "#60a5fa",
  "#34d399",
  "#f87171",
  "#c084fc",
  "#f59e0b",
  "#22d3ee",
  "#a3e635",
  "#fb7185",
  "#2dd4bf",
  "#fbbf24",
  "#818cf8",
  "#94a3b8"
];

export function labelText(label: Label | null | undefined, language: Language) {
  if (!label) {
    return language === "zh" ? "未標記" : "Unlabeled";
  }
  if (label.code === "SECURITY_DEFENSE") {
    return language === "zh" ? "國防安全" : "Defense & Security";
  }
  return language === "zh" ? label.zh : label.en;
}

export function dateTime(value: string | null, language: Language) {
  if (!value) {
    return language === "zh" ? "未提供" : "Not provided";
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat(language === "zh" ? "zh-TW" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function compactDate(value: string, language: Language) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat(language === "zh" ? "zh-TW" : "en-US", {
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function articleTitle(article: {
  title: string;
  titleZh: string | null;
  titleEn: string | null;
}, language: Language) {
  if (language === "zh") {
    return article.titleZh || article.title || "尚未產生中文標題";
  }
  return article.titleEn || article.title || "English title not generated yet";
}

export function articleSummary(article: {
  summary: string | null;
  summaryZh: string | null;
  summaryEn: string | null;
}, language: Language) {
  if (language === "zh") {
    return article.summaryZh ?? "尚未產生分析摘要";
  }
  return article.summaryEn ?? article.summary ?? "Analysis summary not generated yet";
}

export function articleKeywords(article: {
  keywordTerms: string[];
  keywordTermsZh?: string[];
  keywordTermsEn?: string[];
}, language: Language) {
  const localized = language === "zh" ? article.keywordTermsZh : article.keywordTermsEn;
  return localized && localized.length > 0 ? localized : article.keywordTerms;
}

export function hasAnalysisSummary(article: {
  summary: string | null;
  summaryZh: string | null;
  summaryEn: string | null;
}) {
  return Boolean(article.summaryZh ?? article.summaryEn ?? article.summary);
}
