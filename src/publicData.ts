import type {
  ArticleRecord,
  ArticlesResponse,
  Label,
  MediaCandidatesResponse,
  OptionsResponse,
  OverviewData
} from "./types";
import type { ArticleFilters } from "./api";

const ARTICLE_PAGE_SIZE = 15;
const UNLABELED: Label = { code: "UNLABELED", zh: "未標記", en: "Unlabeled" };

type PublicManifest = {
  generatedAt?: string;
  scannedArticleCount?: number;
  historyStartDate?: string | null;
};

let articlesCache: Promise<ArticleRecord[]> | null = null;
let optionsCache: Promise<OptionsResponse> | null = null;
let mediaCandidatesCache: Promise<MediaCandidatesResponse> | null = null;
let manifestCache: Promise<PublicManifest> | null = null;

export async function getPublicOptions(): Promise<OptionsResponse> {
  optionsCache ??= getJson<OptionsResponse>(publicUrl("data/options.json"));
  return optionsCache;
}

export async function getPublicMediaCandidates(): Promise<MediaCandidatesResponse> {
  mediaCandidatesCache ??= getJson<MediaCandidatesResponse>(publicUrl("data/media-candidates.json"));
  return mediaCandidatesCache;
}

export async function getPublicOverview(range: "month" | "history"): Promise<OverviewData> {
  const [articles, options, manifest] = await Promise.all([
    getPublicArticlesData(),
    getPublicOptions(),
    getPublicManifest()
  ]);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-01`;
  const scopedArticles = range === "month"
    ? articles.filter((article) => {
      const date = publishedDatePart(article);
      return date !== null && date >= monthStart;
    })
    : articles;

  return {
    range,
    generatedAt: manifest.generatedAt ?? now.toISOString(),
    totals: {
      scannedArticles: manifest.scannedArticleCount ?? articles.length,
      articles: scopedArticles.length,
      stableLabels: countIssueLabels(scopedArticles, options.stableLabels),
      countryLabels: countCountryLabels(scopedArticles, options.countryLabels)
    },
    daily: buildDailySeries(
      scopedArticles,
      range === "month" ? dateFromPart(monthStart) ?? undefined : dateFromPart(manifest.historyStartDate ?? null) ?? undefined,
      options.stableLabels,
      options.countryLabels
    ),
    options: {
      stableLabels: options.stableLabels,
      countryLabels: options.countryLabels
    }
  };
}

export async function getPublicArticles(filters: ArticleFilters): Promise<ArticlesResponse> {
  let articles = await getPublicArticlesData();
  const period = filters.period ?? "week";
  const pageFilter = filters.page ?? 1;
  const weekStart = formatDate(startOfWeek(new Date()));

  if (period === "week") {
    articles = articles.filter((article) => {
      const date = publishedDatePart(article);
      return date !== null && date >= weekStart;
    });
  }

  if ((filters.stableLabels?.length ?? 0) > 0) {
    articles = articles.filter((article) =>
      matchesLabelFilter(article.issueLabels.map((label) => label.code), filters.stableLabels ?? [])
    );
  }

  if ((filters.countryLabels?.length ?? 0) > 0) {
    articles = articles.filter((article) =>
      matchesLabelFilter(article.countryLabel ? [article.countryLabel.code] : [], filters.countryLabels ?? [])
    );
  }

  if ((filters.sources?.length ?? 0) > 0) {
    articles = articles.filter((article) => filters.sources?.includes(article.sourceCode));
  }

  if (filters.keywords?.trim()) {
    const needle = filters.keywords.trim().toLocaleLowerCase();
    articles = articles.filter((article) =>
      [
        ...article.keywordTerms,
        ...(article.keywordTermsZh ?? []),
        ...(article.keywordTermsEn ?? []),
        article.titleZh,
        article.titleEn
      ]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(needle))
    );
  }

  if (filters.summaryText?.trim()) {
    const needle = filters.summaryText.trim().toLocaleLowerCase();
    articles = articles.filter((article) =>
      [article.summaryZh, article.summaryEn, article.summary]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(needle))
    );
  }

  const totalCount = articles.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ARTICLE_PAGE_SIZE));
  const page = Math.min(Math.max(1, pageFilter), totalPages);
  const offset = (page - 1) * ARTICLE_PAGE_SIZE;

  return {
    period,
    count: totalCount,
    page,
    pageSize: ARTICLE_PAGE_SIZE,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
    articles: articles.slice(offset, offset + ARTICLE_PAGE_SIZE)
  };
}

async function getPublicArticlesData(): Promise<ArticleRecord[]> {
  articlesCache ??= getJson<ArticleRecord[]>(publicUrl("data/articles.json"));
  return articlesCache;
}

async function getPublicManifest(): Promise<PublicManifest> {
  manifestCache ??= getJson<PublicManifest>(publicUrl("data/manifest.json"));
  return manifestCache;
}

function publicUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path}`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function countIssueLabels(articles: ArticleRecord[], labels: Label[]) {
  const counts = new Map(labels.map((label) => [label.code, 0]));
  for (const article of articles) {
    if (article.issueLabels.length === 0) {
      counts.set(UNLABELED.code, (counts.get(UNLABELED.code) ?? 0) + 1);
      continue;
    }
    for (const code of new Set(article.issueLabels.map((label) => label.code))) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return labels.map((label) => ({ ...label, count: counts.get(label.code) ?? 0 }));
}

function countCountryLabels(articles: ArticleRecord[], labels: Label[]) {
  const counts = new Map(labels.map((label) => [label.code, 0]));
  for (const article of articles) {
    const code = article.countryLabel?.code ?? UNLABELED.code;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return labels.map((label) => ({ ...label, count: counts.get(label.code) ?? 0 }));
}

function buildDailySeries(
  articles: ArticleRecord[],
  preferredStart: Date | undefined,
  stableLabels: Label[],
  countryLabels: Label[]
) {
  const datedArticles = articles
    .map((article) => ({ article, date: dateFromPart(publishedDatePart(article)) }))
    .filter((item): item is { article: ArticleRecord; date: Date } => item.date !== null);
  const now = new Date();
  const earliest = preferredStart ?? datedArticles.reduce<Date | null>((candidate, item) => {
    if (!candidate || item.date < candidate) {
      return item.date;
    }
    return candidate;
  }, null) ?? now;
  const dates = dateRange(startOfDay(earliest), startOfDay(now));
  const totalCounts = new Map(dates.map((date) => [date, 0]));
  const issueCounts = new Map(dates.map((date) => [date, zeroCounts(stableLabels)]));
  const countryCounts = new Map(dates.map((date) => [date, zeroCounts(countryLabels)]));

  for (const { article, date } of datedArticles) {
    const day = formatDate(date);
    totalCounts.set(day, (totalCounts.get(day) ?? 0) + 1);

    const issueBucket = issueCounts.get(day) ?? {};
    if (article.issueLabels.length === 0) {
      issueBucket[UNLABELED.code] = (issueBucket[UNLABELED.code] ?? 0) + 1;
    } else {
      for (const code of new Set(article.issueLabels.map((label) => label.code))) {
        issueBucket[code] = (issueBucket[code] ?? 0) + 1;
      }
    }
    issueCounts.set(day, issueBucket);

    const countryBucket = countryCounts.get(day) ?? {};
    const countryCode = article.countryLabel?.code ?? UNLABELED.code;
    countryBucket[countryCode] = (countryBucket[countryCode] ?? 0) + 1;
    countryCounts.set(day, countryBucket);
  }

  return {
    totalArticles: dates.map((date) => ({ date, count: totalCounts.get(date) ?? 0 })),
    stableLabels: dates.map((date) => ({ date, counts: issueCounts.get(date) ?? {} })),
    countryLabels: dates.map((date) => ({ date, counts: countryCounts.get(date) ?? {} }))
  };
}

function zeroCounts(labels: Array<{ code: string }>): Record<string, number> {
  return Object.fromEntries(labels.map((label) => [label.code, 0]));
}

function matchesLabelFilter(articleCodes: string[], selectedCodes: string[]) {
  const hasUnlabeled = articleCodes.length === 0;
  return selectedCodes.some((code) => code === UNLABELED.code ? hasUnlabeled : articleCodes.includes(code));
}

function publishedDatePart(article: Pick<ArticleRecord, "publishedAt">): string | null {
  if (!article.publishedAt) {
    return null;
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(article.publishedAt);
  return match?.[1] ?? null;
}

function dateFromPart(datePart: string | null): Date | null {
  if (!datePart) {
    return null;
  }
  const date = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const diff = (day + 6) % 7;
  result.setDate(result.getDate() - diff);
  return result;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dateRange(start: Date, end: Date): string[] {
  const result: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    result.push(formatDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
