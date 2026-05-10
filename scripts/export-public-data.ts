import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH =
  process.env.PUTINISLAND_DB_PATH ??
  "/Users/chia-shuotang/Documents/PutinIsland/data/putinisland.sqlite";
const MEDIA_CANDIDATES_PATH =
  process.env.PUTINISLAND_MEDIA_CANDIDATES_PATH ??
  "/Users/chia-shuotang/Documents/PutinIsland/sources/media_candidates.md";
const OUT_DIR = process.env.PUTINISLAND_PUBLIC_DATA_DIR ?? "public/data";

type Label = {
  code: string;
  zh: string;
  en: string;
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
  issueLabels: Array<Label & { confidence?: number }>;
  keywordTerms: string[];
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

mkdirSync(OUT_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH, { readOnly: true });
try {
  const articles = loadArticles(db);
  const sources = loadSources(db, articles);
  const scannedArticleCount = loadScannedArticleCount(db);
  writeJson(`${OUT_DIR}/manifest.json`, {
    generatedAt: new Date().toISOString(),
    source: "sqlite-public-export-v1",
    scannedArticleCount,
    articleCount: articles.length,
    maxPublishedDate: articles.map((article) => publishedDatePart(article)).filter(Boolean).sort().at(-1) ?? null
  });
  writeJson(`${OUT_DIR}/options.json`, {
    stableLabels: [UNLABELED, ...ISSUE_LABELS],
    countryLabels: [UNLABELED, ...COUNTRY_LABELS],
    sources
  });
  writeJson(`${OUT_DIR}/articles.json`, articles);
  writeJson(`${OUT_DIR}/media-candidates.json`, parseMediaCandidates());
  console.log(`Exported ${articles.length} public article records to ${OUT_DIR}`);
} finally {
  db.close();
}

function loadArticles(db: DatabaseSync): ArticleRecord[] {
  const rows = db.prepare(`
    SELECT
      a.article_id AS articleId,
      a.canonical_url AS canonicalUrl,
      a.published_at AS publishedAt,
      a.created_at AS capturedAt,
      a.status,
      a.source_code AS sourceCode,
      ms.display_name AS sourceName,
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
    LEFT JOIN article_analysis aa ON aa.article_id = a.article_id
    ORDER BY datetime(a.published_at) DESC, datetime(a.created_at) DESC
  `).all() as Record<string, unknown>[];

  return rows.map((row) => ({
    articleId: value(row.articleId),
    title: "",
    titleZh: nullable(row.titleZh),
    titleEn: nullable(row.titleEn),
    canonicalUrl: value(row.canonicalUrl),
    publishedAt: nullable(row.publishedAt),
    capturedAt: nullable(row.capturedAt),
    status: value(row.status),
    sourceCode: value(row.sourceCode),
    sourceName: value(row.sourceName) || value(row.sourceCode),
    hasRawContent: false,
    summary: nullable(row.summary),
    summaryZh: nullable(row.summaryZh),
    summaryEn: nullable(row.summaryEn),
    description: null,
    countryLabel: parseCountryLabel(row),
    issueLabels: parseIssueLabels(nullable(row.issueLabelsJson)),
    keywordTerms: parseKeywordTerms(nullable(row.keywordsJson))
  }));
}

function loadSources(db: DatabaseSync, articles: ArticleRecord[]) {
  const rows = db.prepare(`
    SELECT source_code AS sourceCode, display_name AS displayName, country,
           language, homepage_url AS homepageUrl, feed_url AS feedUrl,
           is_monitored AS isMonitored
    FROM media_sources
    ORDER BY display_name COLLATE NOCASE
  `).all() as Record<string, unknown>[];
  return rows.map((row) => {
    const sourceCode = value(row.sourceCode);
    return {
      sourceCode,
      displayName: value(row.displayName),
      country: nullable(row.country),
      language: nullable(row.language),
      homepageUrl: nullable(row.homepageUrl),
      feedUrl: nullable(row.feedUrl),
      isMonitored: Number(row.isMonitored) === 1,
      articleCount: articles.filter((article) => article.sourceCode === sourceCode).length
    };
  });
}

function loadScannedArticleCount(db: DatabaseSync): number {
  const row = db.prepare(`
    SELECT COUNT(DISTINCT COALESCE(NULLIF(canonical_url, ''), candidate_id)) AS count
    FROM source_candidates
    WHERE superseded_by_candidate_id IS NULL
  `).get() as { count?: unknown } | undefined;
  return Number(row?.count ?? 0);
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

function parseIssueLabels(raw: string | null): Array<Label & { confidence?: number }> {
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

function parseMediaCandidates() {
  const markdown = readFileSync(MEDIA_CANDIDATES_PATH, "utf8");
  const lines = markdown.split(/\r?\n/);
  const checkedDate = lines.find((line) => line.startsWith("查核日期："))?.replace("查核日期：", "").trim() ?? null;
  const tableStart = lines.findIndex((line) => line.startsWith("| 地區/主要目標 |"));
  const tableRows: string[] = [];
  if (tableStart !== -1) {
    for (const line of lines.slice(tableStart + 2)) {
      if (!line.startsWith("|")) {
        break;
      }
      tableRows.push(line);
    }
  }

  return {
    checkedDate,
    path: "sources/media_candidates.md",
    rows: tableRows.map((line) => {
      const cells = splitMarkdownTableRow(line);
      return {
        targetRegion: cells[0] ?? "",
        name: cells[1] ?? "",
        englishName: cells[2] ?? "",
        chineseName: cells[3] ?? "",
        homepageUrl: cells[4] ?? "",
        attributionSource: cells[5] ?? "",
        evidenceSummary: cells[6] ?? "",
        urlCheck: cells[7] ?? ""
      };
    })
  };
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
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

function publishedDatePart(article: Pick<ArticleRecord, "publishedAt">): string | null {
  if (!article.publishedAt) {
    return null;
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(article.publishedAt);
  return match?.[1] ?? null;
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

function writeJson(path: string, payload: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
