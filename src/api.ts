import type {
  ArticlesResponse,
  MediaCandidatesResponse,
  OptionsResponse,
  RawArticleResponse,
  OverviewData
} from "./types";
import {
  getPublicArticles,
  getPublicMediaCandidates,
  getPublicOptions,
  getPublicOverview
} from "./publicData";

export const PUBLIC_MODE = import.meta.env.VITE_PUBLIC_MODE === "true";

export type ArticleFilters = {
  period?: "week" | "history";
  page?: number;
  stableLabels?: string[];
  countryLabels?: string[];
  sources?: string[];
  keywords?: string;
  summaryText?: string;
};

export async function getOverview(range: "month" | "history"): Promise<OverviewData> {
  if (PUBLIC_MODE) {
    return getPublicOverview(range);
  }
  return getJson(`/api/overview?range=${range}`);
}

export async function getOptions(): Promise<OptionsResponse> {
  if (PUBLIC_MODE) {
    return getPublicOptions();
  }
  return getJson("/api/options");
}

export async function getArticles(filters: ArticleFilters): Promise<ArticlesResponse> {
  if (PUBLIC_MODE) {
    return getPublicArticles(filters);
  }
  const params = new URLSearchParams();
  params.set("period", filters.period ?? "week");
  params.set("page", `${filters.page ?? 1}`);
  setList(params, "stableLabels", filters.stableLabels);
  setList(params, "countryLabels", filters.countryLabels);
  setList(params, "sources", filters.sources);
  if (filters.keywords?.trim()) {
    params.set("keywords", filters.keywords.trim());
  }
  if (filters.summaryText?.trim()) {
    params.set("summaryText", filters.summaryText.trim());
  }
  return getJson(`/api/articles?${params.toString()}`);
}

export async function getMediaCandidates(): Promise<MediaCandidatesResponse> {
  if (PUBLIC_MODE) {
    return getPublicMediaCandidates();
  }
  return getJson("/api/sources/candidates");
}

export async function getRawArticle(articleId: string): Promise<RawArticleResponse> {
  if (PUBLIC_MODE) {
    throw new Error("Raw article text is not available in public mode");
  }
  return getJson(`/api/articles/${encodeURIComponent(articleId)}/raw`);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function setList(params: URLSearchParams, key: string, value: string[] | undefined) {
  const cleaned = value?.filter(Boolean) ?? [];
  if (cleaned.length > 0) {
    params.set(key, cleaned.join(","));
  }
}
