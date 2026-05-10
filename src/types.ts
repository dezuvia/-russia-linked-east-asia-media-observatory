export type Label = {
  code: string;
  zh: string;
  en: string;
};

export type LabelCount = Label & {
  count: number;
};

export type OverviewData = {
  range: "month" | "history";
  generatedAt: string;
  totals: {
    scannedArticles: number;
    articles: number;
    stableLabels: LabelCount[];
    countryLabels: LabelCount[];
  };
  weekly: {
    totalArticles: Array<{ weekStart: string; count: number }>;
    stableLabels: Array<{ weekStart: string; counts: Record<string, number> }>;
    countryLabels: Array<{ weekStart: string; counts: Record<string, number> }>;
  };
  options: {
    stableLabels: Label[];
    countryLabels: Label[];
  };
};

export type ArticleRecord = {
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
  keywordTermsZh: string[];
  keywordTermsEn: string[];
};

export type RawArticleResponse = {
  articleId: string;
  title: string;
  sourceName: string;
  publishedAt: string | null;
  capturedAt: string | null;
  contentPath: string | null;
  content: string;
};

export type ArticlesResponse = {
  period: "week" | "history";
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  articles: ArticleRecord[];
};

export type SourceOption = {
  sourceCode: string;
  displayName: string;
  country: string | null;
  language: string | null;
  homepageUrl: string | null;
  feedUrl: string | null;
  isMonitored: boolean;
  articleCount: number;
};

export type OptionsResponse = {
  stableLabels: Label[];
  countryLabels: Label[];
  sources: SourceOption[];
};

export type MediaCandidate = {
  targetRegion: string;
  name: string;
  englishName: string;
  chineseName: string;
  homepageUrl: string;
  attributionSource: string;
  evidenceSummary: string;
  urlCheck: string;
};

export type MediaCandidatesResponse = {
  checkedDate: string | null;
  path: string;
  rows: MediaCandidate[];
};
