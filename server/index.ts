import express from "express";
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { bilingualKeywordTerms, loadKeywordTranslationCache } from "../scripts/keyword-translation-cache";

const PORT = Number(process.env.PORT ?? 5174);
const ARTICLE_PAGE_SIZE = 15;
const DB_PATH =
  process.env.PUTINISLAND_DB_PATH ??
  "/Users/chia-shuotang/Documents/PutinIsland/data/putinisland.sqlite";
const MEDIA_CANDIDATES_PATH =
  process.env.PUTINISLAND_MEDIA_CANDIDATES_PATH ??
  "/Users/chia-shuotang/Documents/PutinIsland/sources/media_candidates_ru.md";

type Label = {
  code: string;
  zh: string;
  en: string;
};

type IssueLabel = Label & {
  confidence?: number;
};

type ArticleRecord = {
  articleId: string;
  title: string;
  titleZh: string | null;
  titleEn: string | null;
  canonicalUrl: string;
  publishedAt: string | null;
  capturedAt: string | null;
  status: string;
  sourceCode: string;
  sourceName: string;
  hasRawContent: boolean;
  summary: string | null;
  summaryZh: string | null;
  summaryEn: string | null;
  description: string | null;
  countryLabel: Label | null;
  issueLabels: IssueLabel[];
  keywordTerms: string[];
  keywordTermsZh: string[];
  keywordTermsEn: string[];
};

const ISSUE_LABELS: Label[] = [
  { code: "SECURITY_DEFENSE", zh: "安全防務", en: "Security & Defense" },
  { code: "DIPLOMACY", zh: "外交", en: "Diplomacy" },
  { code: "ECONOMY_TRADE", zh: "經濟貿易", en: "Economy & Trade" },
  { code: "TECHNOLOGY", zh: "科技", en: "Technology" },
  { code: "ENERGY_RESOURCES", zh: "能源資源", en: "Energy & Resources" },
  { code: "DOMESTIC_POLITICS", zh: "內政", en: "Domestic Politics" },
  { code: "LAW_GOVERNANCE", zh: "法治治理", en: "Law & Governance" },
  { code: "PUBLIC_HEALTH", zh: "公共衛生", en: "Public Health" },
  { code: "SOCIETY_CULTURE", zh: "社會文化", en: "Society & Culture" },
  { code: "ENVIRONMENT_DISASTER", zh: "環境災害", en: "Environment & Disaster" }
];

const COUNTRY_LABELS: Label[] = [
  { code: "TAIWAN", zh: "台灣", en: "Taiwan" },
  { code: "CHINA", zh: "中國", en: "China" },
  { code: "JAPAN", zh: "日本", en: "Japan" },
  { code: "SOUTH_KOREA", zh: "南韓", en: "South Korea" },
  { code: "TAIWAN_CHINA", zh: "中台", en: "Taiwan-China" },
  { code: "CHINA_JAPAN", zh: "中日", en: "China-Japan" },
  { code: "CHINA_SOUTH_KOREA", zh: "中韓", en: "China-South Korea" },
  { code: "TAIWAN_JAPAN", zh: "台日", en: "Taiwan-Japan" },
  { code: "TAIWAN_SOUTH_KOREA", zh: "台韓", en: "Taiwan-South Korea" },
  { code: "JAPAN_SOUTH_KOREA", zh: "日韓", en: "Japan-South Korea" },
  { code: "REGIONAL", zh: "區域", en: "Regional" }
];

const UNLABELED: Label = { code: "UNLABELED", zh: "未標記", en: "Unlabeled" };

const app = express();

app.get("/api/health", (_req, res) => {
  res.json({
    ok: existsSync(DB_PATH),
    dbPath: DB_PATH,
    mediaCandidatesPath: MEDIA_CANDIDATES_PATH
  });
});

app.get("/api/options", (_req, res) => {
  try {
    const articles = loadArticles();
    res.json({
      stableLabels: [UNLABELED, ...ISSUE_LABELS],
      countryLabels: [UNLABELED, ...COUNTRY_LABELS],
      sources: loadSources().map((source) => ({
        ...source,
        articleCount: articles.filter((article) => article.sourceCode === source.sourceCode).length
      }))
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/overview", (req, res) => {
  try {
    const range = req.query.range === "history" ? "history" : "month";
    const articles = loadArticles();
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-01`;
    const scopedArticles = range === "month" ? articles.filter((article) => {
      const date = publishedDatePart(article);
      return date !== null && date >= monthStart;
    }) : articles;

    res.json({
      range,
      generatedAt: now.toISOString(),
      totals: {
        scannedArticles: loadScannedArticleCount(),
        articles: scopedArticles.length,
        stableLabels: countIssueLabels(scopedArticles),
        countryLabels: countCountryLabels(scopedArticles)
      },
      daily: buildDailySeries(scopedArticles, range === "month" ? dateFromPart(monthStart) ?? undefined : undefined),
      options: {
        stableLabels: [UNLABELED, ...ISSUE_LABELS],
        countryLabels: [UNLABELED, ...COUNTRY_LABELS]
      }
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/articles", (req, res) => {
  try {
    const filters = {
      period: req.query.period === "history" ? "history" : "week",
      page: positiveInt(req.query.page, 1),
      stableLabels: splitParam(req.query.stableLabels),
      countryLabels: splitParam(req.query.countryLabels),
      sources: splitParam(req.query.sources),
      keywords: stringParam(req.query.keywords),
      summaryText: stringParam(req.query.summaryText)
    };

    const weekStart = formatDate(startOfWeek(new Date()));
    let articles = loadArticles();

    if (filters.period === "week") {
      articles = articles.filter((article) => {
        const date = publishedDatePart(article);
        return date !== null && date >= weekStart;
      });
    }

    if (filters.stableLabels.length > 0) {
      articles = articles.filter((article) =>
        matchesLabelFilter(article.issueLabels.map((label) => label.code), filters.stableLabels)
      );
    }

    if (filters.countryLabels.length > 0) {
      articles = articles.filter((article) =>
        matchesLabelFilter(article.countryLabel ? [article.countryLabel.code] : [], filters.countryLabels)
      );
    }

    if (filters.sources.length > 0) {
      articles = articles.filter((article) => filters.sources.includes(article.sourceCode));
    }

    if (filters.keywords) {
      const needle = filters.keywords.toLocaleLowerCase();
      articles = articles.filter((article) =>
        [
          ...article.keywordTerms,
          ...article.keywordTermsZh,
          ...article.keywordTermsEn,
          article.title,
          article.titleZh,
          article.titleEn
        ]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(needle))
      );
    }

    if (filters.summaryText) {
      const needle = filters.summaryText.toLocaleLowerCase();
      articles = articles.filter((article) =>
        [article.summaryZh, article.summaryEn, article.summary]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(needle))
      );
    }

    const totalCount = articles.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / ARTICLE_PAGE_SIZE));
    const page = Math.min(filters.page, totalPages);
    const offset = (page - 1) * ARTICLE_PAGE_SIZE;

    res.json({
      period: filters.period,
      count: totalCount,
      page,
      pageSize: ARTICLE_PAGE_SIZE,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
      articles: articles.slice(offset, offset + ARTICLE_PAGE_SIZE)
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/articles/:articleId/raw", (req, res) => {
  try {
    const db = openDb();
    try {
      const row = db.prepare(`
        SELECT
          a.article_id AS articleId,
          a.title,
          a.published_at AS publishedAt,
          a.created_at AS capturedAt,
          a.content_path AS contentPath,
          COALESCE(ms.display_name, a.source_code) AS sourceName
        FROM articles a
        LEFT JOIN media_sources ms ON ms.source_code = a.source_code
        WHERE a.article_id = ?
      `).get(req.params.articleId) as Record<string, unknown> | undefined;

      if (!row) {
        res.status(404).json({ error: "Article not found" });
        return;
      }

      const contentPath = nullable(row.contentPath);
      const content = contentPath && existsSync(contentPath)
        ? readFileSync(contentPath, "utf8")
        : "";
      res.json({
        articleId: value(row.articleId),
        title: value(row.title),
        sourceName: value(row.sourceName),
        publishedAt: nullable(row.publishedAt),
        capturedAt: nullable(row.capturedAt),
        contentPath,
        content
      });
    } finally {
      db.close();
    }
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/sources/candidates", (_req, res) => {
  try {
    res.json(parseMediaCandidates());
  } catch (error) {
    sendError(res, error);
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Media observatory dashboard API listening on http://127.0.0.1:${PORT}`);
});

function openDb(): DatabaseSync {
  if (!existsSync(DB_PATH)) {
    throw new Error(`SQLite database not found: ${DB_PATH}`);
  }
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

function loadArticles(): ArticleRecord[] {
  const db = openDb();
  try {
    const keywordTranslationCache = loadKeywordTranslationCache();
    const rows = db.prepare(`
      SELECT
        a.article_id AS articleId,
        a.title,
        a.canonical_url AS canonicalUrl,
        a.published_at AS publishedAt,
        a.created_at AS capturedAt,
        a.status,
        a.content_path AS contentPath,
        a.source_code AS sourceCode,
        ms.display_name AS sourceName,
        sc.description,
        aa.summary,
        aa.title_zh AS titleZh,
        aa.title_en AS titleEn,
        aa.summary_zh AS summaryZh,
        aa.summary_en AS summaryEn,
        aa.country_label_code AS countryLabelCode,
        aa.country_label_zh AS countryLabelZh,
        aa.country_label_en AS countryLabelEn,
        aa.issue_labels_json AS issueLabelsJson,
        aa.keywords_json AS keywordsJson
      FROM articles a
      LEFT JOIN media_sources ms ON ms.source_code = a.source_code
      LEFT JOIN source_candidates sc ON sc.candidate_id = a.candidate_id
      LEFT JOIN article_analysis aa ON aa.article_id = a.article_id
      ORDER BY datetime(a.published_at) DESC, datetime(a.created_at) DESC
    `).all() as Record<string, unknown>[];

    return rows.map((row) => {
      const keywordTerms = parseKeywordTerms(nullable(row.keywordsJson));
      return {
        articleId: value(row.articleId),
        title: value(row.title),
        titleZh: nullable(row.titleZh),
        titleEn: nullable(row.titleEn),
        canonicalUrl: value(row.canonicalUrl),
        publishedAt: nullable(row.publishedAt),
        capturedAt: nullable(row.capturedAt),
        status: value(row.status),
        sourceCode: value(row.sourceCode),
        sourceName: value(row.sourceName) || value(row.sourceCode),
        hasRawContent: Boolean(nullable(row.contentPath)),
        summary: nullable(row.summary),
        summaryZh: nullable(row.summaryZh),
        summaryEn: nullable(row.summaryEn),
        description: nullable(row.description),
        countryLabel: parseCountryLabel(row),
        issueLabels: parseIssueLabels(nullable(row.issueLabelsJson)),
        keywordTerms,
        ...bilingualKeywordTerms(keywordTerms, keywordTranslationCache)
      };
    });
  } finally {
    db.close();
  }
}

function loadSources(): Array<{
  sourceCode: string;
  displayName: string;
  country: string | null;
  language: string | null;
  homepageUrl: string | null;
  feedUrl: string | null;
  isMonitored: boolean;
}> {
  const db = openDb();
  try {
    const rows = db.prepare(`
      SELECT source_code AS sourceCode, display_name AS displayName, country,
             language, homepage_url AS homepageUrl, feed_url AS feedUrl,
             is_monitored AS isMonitored
      FROM media_sources
      ORDER BY display_name COLLATE NOCASE
    `).all() as Record<string, unknown>[];
    return rows.map((row) => ({
      sourceCode: value(row.sourceCode),
      displayName: value(row.displayName),
      country: nullable(row.country),
      language: nullable(row.language),
      homepageUrl: nullable(row.homepageUrl),
      feedUrl: nullable(row.feedUrl),
      isMonitored: Number(row.isMonitored) === 1
    }));
  } finally {
    db.close();
  }
}

function loadScannedArticleCount(): number {
  const db = openDb();
  try {
    const row = db.prepare(`
      SELECT COUNT(DISTINCT COALESCE(NULLIF(canonical_url, ''), candidate_id)) AS count
      FROM source_candidates
      WHERE superseded_by_candidate_id IS NULL
    `).get() as { count?: unknown } | undefined;
    return Number(row?.count ?? 0);
  } finally {
    db.close();
  }
}

function parseCountryLabel(row: Record<string, unknown>): Label | null {
  const code = nullable(row.countryLabelCode);
  if (!code) {
    return null;
  }
  const known = COUNTRY_LABELS.find((label) => label.code === code);
  return {
    code,
    zh: nullable(row.countryLabelZh) ?? known?.zh ?? code,
    en: nullable(row.countryLabelEn) ?? known?.en ?? code
  };
}

function parseIssueLabels(raw: string | null): IssueLabel[] {
  const parsed = parseJsonArray(raw);
  return parsed.flatMap((item) => {
    if (!isRecord(item) || typeof item.code !== "string") {
      return [];
    }
    const known = ISSUE_LABELS.find((label) => label.code === item.code);
    return [{
      code: item.code,
      zh: typeof item.label_zh === "string" ? item.label_zh : known?.zh ?? item.code,
      en: typeof item.label_en === "string" ? item.label_en : known?.en ?? item.code,
      confidence: typeof item.confidence === "number" ? item.confidence : undefined
    }];
  });
}

function parseKeywordTerms(raw: string | null): string[] {
  return parseJsonArray(raw).flatMap((item) => {
    if (isRecord(item) && typeof item.term === "string") {
      return [item.term];
    }
    return [];
  });
}

function parseJsonArray(raw: string | null): unknown[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function countIssueLabels(articles: ArticleRecord[]) {
  const counts = new Map<string, number>([UNLABELED, ...ISSUE_LABELS].map((label) => [label.code, 0]));
  for (const article of articles) {
    if (article.issueLabels.length === 0) {
      counts.set(UNLABELED.code, (counts.get(UNLABELED.code) ?? 0) + 1);
      continue;
    }
    for (const code of new Set(article.issueLabels.map((label) => label.code))) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return [UNLABELED, ...ISSUE_LABELS].map((label) => ({ ...label, count: counts.get(label.code) ?? 0 }));
}

function countCountryLabels(articles: ArticleRecord[]) {
  const counts = new Map<string, number>([UNLABELED, ...COUNTRY_LABELS].map((label) => [label.code, 0]));
  for (const article of articles) {
    const code = article.countryLabel?.code ?? UNLABELED.code;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [UNLABELED, ...COUNTRY_LABELS].map((label) => ({ ...label, count: counts.get(label.code) ?? 0 }));
}

function buildDailySeries(articles: ArticleRecord[], preferredStart?: Date) {
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
  const issueCounts = new Map(dates.map((date) => [date, zeroCounts([UNLABELED, ...ISSUE_LABELS])]));
  const countryCounts = new Map(dates.map((date) => [date, zeroCounts([UNLABELED, ...COUNTRY_LABELS])]));

  for (const { article, date } of datedArticles) {
    const day = formatDate(date);
    totalCounts.set(day, (totalCounts.get(day) ?? 0) + 1);

    const issueBucket = issueCounts.get(day) ?? zeroCounts([UNLABELED, ...ISSUE_LABELS]);
    if (article.issueLabels.length === 0) {
      issueBucket[UNLABELED.code] += 1;
    } else {
      for (const code of new Set(article.issueLabels.map((label) => label.code))) {
        issueBucket[code] = (issueBucket[code] ?? 0) + 1;
      }
    }
    issueCounts.set(day, issueBucket);

    const countryBucket = countryCounts.get(day) ?? zeroCounts([UNLABELED, ...COUNTRY_LABELS]);
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

function zeroCounts(labels: Label[]): Record<string, number> {
  return Object.fromEntries(labels.map((label) => [label.code, 0]));
}

function parseMediaCandidates() {
  if (!existsSync(MEDIA_CANDIDATES_PATH)) {
    throw new Error(`Media candidates markdown not found: ${MEDIA_CANDIDATES_PATH}`);
  }
  const markdown = readFileSync(MEDIA_CANDIDATES_PATH, "utf8");
  const lines = markdown.split(/\r?\n/);
  const checkedDate = lines.find((line) => line.startsWith("查核日期："))?.replace("查核日期：", "").trim() ?? null;
  const tableStart = lines.findIndex((line) => line.startsWith("| 地區/主要目標 |"));
  if (tableStart === -1) {
    return { checkedDate, path: `sources/${basename(MEDIA_CANDIDATES_PATH)}`, rows: [] };
  }
  const headerCells = splitMarkdownTableRow(lines[tableStart]);
  const tableRows: string[] = [];
  for (const line of lines.slice(tableStart + 2)) {
    if (!line.startsWith("|")) {
      break;
    }
    tableRows.push(line);
  }

  return {
    checkedDate,
    path: `sources/${basename(MEDIA_CANDIDATES_PATH)}`,
    rows: tableRows.map((line) => parseMediaCandidateRow(splitMarkdownTableRow(line), headerCells))
  };
}

function parseMediaCandidateRow(cells: string[], headerCells: string[]) {
  return {
    targetRegion: cellByHeader(cells, headerCells, "地區/主要目標"),
    name: cellByHeader(cells, headerCells, "名稱"),
    englishName: cellByHeader(cells, headerCells, "常見英文翻譯"),
    chineseName: cellByHeader(cells, headerCells, "中文翻譯"),
    homepageUrl: cellByHeader(cells, headerCells, "主站 URL"),
    originOrControl: optionalCellByHeader(cells, headerCells, "來源國家/控制地"),
    attributionSource: cellByHeader(cells, headerCells, "指認來源"),
    evidenceSummary: cellByHeader(cells, headerCells, "指認摘要與 evidence URL"),
    scaleDescription: optionalCellByHeader(cells, headerCells, "規模/影響力描述"),
    standardCategory: optionalCellByHeader(cells, headerCells, "標準分類"),
    urlCheck: cellByHeader(cells, headerCells, "URL 檢查")
  };
}

function optionalCellByHeader(cells: string[], headerCells: string[], header: string): string | null {
  const value = cellByHeader(cells, headerCells, header);
  return value === "" ? null : value;
}

function cellByHeader(cells: string[], headerCells: string[], header: string): string {
  const index = headerCells.indexOf(header);
  return index === -1 ? "" : cells[index] ?? "";
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function matchesLabelFilter(articleCodes: string[], selectedCodes: string[]) {
  const hasUnlabeled = articleCodes.length === 0;
  return selectedCodes.some((code) => code === UNLABELED.code ? hasUnlabeled : articleCodes.includes(code));
}

function splitParam(value: unknown): string[] {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function stringParam(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "string") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function publishedDatePart(article: ArticleRecord): string | null {
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

function nullable(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function value(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendError(res: express.Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(500).json({ error: message });
}
