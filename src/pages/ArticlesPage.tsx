import { FormEvent, useEffect, useState } from "react";
import { IconAdjustmentsHorizontal, IconChevronDown, IconExternalLink, IconFileText, IconSearch, IconX } from "@tabler/icons-react";
import { getArticles, getOptions, getRawArticle, PUBLIC_MODE, type ArticleFilters } from "../api";
import { articleKeywords, articleSummary, articleTitle, dateTime, hasAnalysisSummary, labelText } from "../format";
import type { ArticleRecord, ArticlesResponse, OptionsResponse, RawArticleResponse } from "../types";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import LabelSelector from "../components/LabelSelector";
import { useI18n } from "../i18n";

const initialFilters: ArticleFilters = {
  period: "history",
  stableLabels: [],
  countryLabels: [],
  sources: [],
  keywords: "",
  summaryText: ""
};

export default function ArticlesPage() {
  const { language, t } = useI18n();
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [filters, setFilters] = useState<ArticleFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<ArticleFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ArticlesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rawArticle, setRawArticle] = useState<RawArticleResponse | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [rawLoadingId, setRawLoadingId] = useState<string | null>(null);

  useEffect(() => {
    getOptions().then(setOptions).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    setError(null);
    getArticles({ ...filters, page }).then(setData).catch((err: Error) => setError(err.message));
  }, [filters, page]);

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setFilters(draftFilters);
  }

  function resetSearch() {
    setDraftFilters(initialFilters);
    setPage(1);
    setFilters(initialFilters);
  }

  function setPeriod(period: "week" | "history") {
    setPage(1);
    setFilters((current) => ({ ...current, period }));
    setDraftFilters((current) => ({ ...current, period }));
  }

  function openRawArticle(article: ArticleRecord) {
    setRawArticle(null);
    setRawError(null);
    setRawLoadingId(article.articleId);
    getRawArticle(article.articleId)
      .then(setRawArticle)
      .catch((err: Error) => setRawError(err.message))
      .finally(() => setRawLoadingId(null));
  }

  return (
    <main className="page-body">
      <div className="container-xl">
        <div className="page-toolbar d-print-none">
          <div className="row align-items-center justify-content-end">
            <div className="col-auto">
              <div className="btn-list">
                <PeriodButton
                  active={(filters.period ?? "history") === "week"}
                  label={t("本週", "This Week")}
                  onClick={() => setPeriod("week")}
                />
                <PeriodButton
                  active={(filters.period ?? "history") === "history"}
                  label={t("全部", "All")}
                  onClick={() => setPeriod("history")}
                />
              </div>
            </div>
          </div>
        </div>

        {error && <ErrorBlock message={error} />}
        {!error && (!data || !options) && <LoadingBlock />}
        {data && options && (
          <>
            <div className="card mb-3">
              <div className="card-body">
                <ArticleSearchPanel
                  advancedOpen={advancedOpen}
                  filters={draftFilters}
                  options={options}
                  onAdvancedOpenChange={setAdvancedOpen}
                  onChange={setDraftFilters}
                  onReset={resetSearch}
                  onSubmit={applySearch}
                />
                <div className="article-result-bar">
                  <span className="badge bg-blue-lt">
                    {t("結果", "Results")}: {data.count}
                  </span>
                  <span className="badge bg-blue-lt">
                    {t("頁", "Page")}: {data.page} / {data.totalPages}
                  </span>
                  <span className="badge bg-secondary-lt">
                    {t("顯示", "Showing")}: {visibleRange(data)}
                  </span>
                  <span className="badge bg-azure-lt">
                    {data.period === "week" ? t("本週", "This Week") : t("全部", "All")}
                  </span>
                  {hasActiveFilters(filters) && (
                    <button className="btn btn-sm btn-outline-secondary" type="button" onClick={resetSearch}>
                      <IconX size={16} />
                      {t("清除搜尋", "Clear Search")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="article-list">
              {data.articles.length === 0 ? (
                <div className="empty card">
                  <p className="empty-title">{t("沒有符合條件的文章", "No Matching Articles")}</p>
                </div>
              ) : (
                data.articles.map((article) => (
                  <ArticleItem
                    key={article.articleId}
                    article={article}
                    onShowRaw={openRawArticle}
                    isRawLoading={rawLoadingId === article.articleId}
                  />
                ))
              )}
            </div>
            {data.totalPages > 1 && <Pagination data={data} onPageChange={setPage} />}
          </>
        )}
      </div>

      {(rawArticle || rawError || rawLoadingId) && (
        <RawArticleModal
          article={rawArticle}
          error={rawError}
          loading={Boolean(rawLoadingId)}
          onClose={() => {
            setRawArticle(null);
            setRawError(null);
            setRawLoadingId(null);
          }}
        />
      )}
    </main>
  );
}

function Pagination({
  data,
  onPageChange
}: {
  data: ArticlesResponse;
  onPageChange: (page: number) => void;
}) {
  const { language, t } = useI18n();
  const pages = pageWindow(data.page, data.totalPages);
  return (
    <div className="card pagination-card">
      <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="text-secondary small">{t("顯示", "Showing")}: {visibleRange(data)}</div>
        <div className="btn-list">
          <button
            className="btn btn-outline-secondary"
            type="button"
            disabled={!data.hasPreviousPage}
            onClick={() => onPageChange(data.page - 1)}
          >
            {t("上一頁", "Previous")}
          </button>
          {pages.map((pageNumber) => (
            <button
              key={pageNumber}
              className={`btn ${pageNumber === data.page ? "btn-primary" : "btn-outline-secondary"}`}
              type="button"
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button
            className="btn btn-outline-secondary"
            type="button"
            disabled={!data.hasNextPage}
            onClick={() => onPageChange(data.page + 1)}
          >
            {t("下一頁", "Next")}
          </button>
        </div>
      </div>
    </div>
  );
}

function visibleRange(data: ArticlesResponse) {
  if (data.count === 0) {
    return "0 - 0";
  }
  const start = (data.page - 1) * data.pageSize + 1;
  const end = Math.min(data.page * data.pageSize, data.count);
  return `${start} - ${end}`;
}

function pageWindow(current: number, total: number) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function ArticleItem({
  article,
  onShowRaw,
  isRawLoading
}: {
  article: ArticleRecord;
  onShowRaw: (article: ArticleRecord) => void;
  isRawLoading: boolean;
}) {
  const { language, t } = useI18n();
  const keywords = articleKeywords(article, language);
  return (
    <article className="card article-card">
      <div className="card-body">
        <div className="row g-3">
          <div className="col-lg">
            <div className="d-flex align-items-start justify-content-between gap-3">
              <div>
                <h2 className="article-title">
                  <a href={article.canonicalUrl} target="_blank" rel="noreferrer">
                    {articleTitle(article, language)}
                  </a>
                </h2>
                <div className="text-secondary small">
                  {t("新聞日期", "Published")}: {dateTime(article.publishedAt, language)} · {t("抓取", "Captured")}: {dateTime(article.capturedAt, language)} · {article.sourceName}
                </div>
              </div>
              {!PUBLIC_MODE && (
                <button
                  className="btn btn-outline-primary flex-shrink-0"
                  type="button"
                  disabled={!article.hasRawContent || isRawLoading}
                  onClick={() => onShowRaw(article)}
                >
                  <IconFileText size={18} />
                  {isRawLoading ? t("載入", "Loading") : t("顯示原文", "Show Raw")}
                </button>
              )}
              <a
                className="btn btn-icon btn-outline-secondary flex-shrink-0"
                href={article.canonicalUrl}
                target="_blank"
                rel="noreferrer"
                title={t("開啟原站連結", "Open source link")}
                aria-label={t("開啟原站連結", "Open source link")}
              >
                <IconExternalLink size={18} />
              </a>
            </div>
            <div className={hasAnalysisSummary(article) ? "article-summary" : "article-summary missing-summary"}>
              {articleSummary(article, language)}
            </div>
            {!hasAnalysisSummary(article) && article.description && (
              <div className="feed-description-note">
                {t("有來源 feed description，但未作為摘要顯示", "Feed description exists but is not shown as a summary")}
              </div>
            )}
          </div>
          <div className="col-lg-4">
            <div className="meta-grid">
              <MetaBlock
                label={t("穩定標籤", "Stable Label")}
                value={
                  article.issueLabels.length > 0
                    ? article.issueLabels.map((label) => labelText(label, language)).join(", ")
                    : t("未標記", "Unlabeled")
                }
              />
              <MetaBlock label={t("國家標籤", "Country Label")} value={labelText(article.countryLabel, language)} />
              <MetaBlock label={t("來源媒體", "Source Media")} value={article.sourceName} />
              <MetaBlock
                label={t("關鍵字", "Keywords")}
                value={keywords.length > 0 ? keywords.join(", ") : t("無", "None")}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-secondary small">{label}</div>
      <div className="fw-medium meta-value">{value}</div>
    </div>
  );
}

function ArticleSearchPanel({
  advancedOpen,
  filters,
  options,
  onSubmit,
  onReset,
  onChange,
  onAdvancedOpenChange
}: {
  advancedOpen: boolean;
  filters: ArticleFilters;
  options: OptionsResponse;
  onSubmit: (event: FormEvent) => void;
  onReset: () => void;
  onChange: (filters: ArticleFilters) => void;
  onAdvancedOpenChange: (open: boolean) => void;
}) {
  const { language, t } = useI18n();
  const quickCountryLabels = countryQuickLabels(options);
  const advancedCountryLabels = options.countryLabels.filter(
    (label) => !quickCountryLabels.some((quickLabel) => quickLabel.code === label.code)
  );
  const activeCountryCodes = new Set(filters.countryLabels ?? []);

  return (
    <form className="article-search-panel" onSubmit={onSubmit}>
      <div className="article-search-main">
        <div>
          <label className="form-label">{t("國家標籤", "Country Label")}</label>
          <div className="article-quick-labels">
            {quickCountryLabels.map((label) => (
              <button
                className={`btn btn-sm ${activeCountryCodes.has(label.code) ? "btn-primary" : "btn-outline-secondary"}`}
                key={label.code}
                type="button"
                onClick={() => onChange({
                  ...filters,
                  countryLabels: toggleValue(filters.countryLabels ?? [], label.code)
                })}
              >
                {labelText(label, language)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">{t("摘要包含文字", "Summary Contains Text")}</label>
          <div className="input-icon">
            <span className="input-icon-addon">
              <IconSearch size={18} />
            </span>
            <input
              className="form-control"
              value={filters.summaryText ?? ""}
              onChange={(event) => onChange({ ...filters, summaryText: event.target.value })}
              placeholder={t("輸入摘要文字", "Enter summary text")}
            />
          </div>
        </div>
      </div>

      {advancedOpen && (
        <div className="article-search-advanced">
          <div>
            <label className="form-label">{t("穩定標籤", "Stable Label")}</label>
            <LabelSelector
              labels={options.stableLabels}
              selected={filters.stableLabels ?? []}
              onChange={(stableLabels) => onChange({ ...filters, stableLabels })}
              compact
            />
          </div>
          {advancedCountryLabels.length > 0 && (
            <div>
              <label className="form-label">{t("其他國家標籤", "Other Country Labels")}</label>
              <LabelSelector
                labels={advancedCountryLabels}
                selected={filters.countryLabels ?? []}
                onChange={(countryLabels) => onChange({ ...filters, countryLabels })}
                compact
              />
            </div>
          )}
          <div className="article-search-grid">
            <div>
              <label className="form-label">{t("來源媒體", "Source Media")}</label>
              <select
                className="form-select"
                value={(filters.sources ?? [])[0] ?? ""}
                onChange={(event) =>
                  onChange({ ...filters, sources: event.target.value ? [event.target.value] : [] })
                }
              >
                <option value="">{t("全部來源", "All Sources")}</option>
                {options.sources.filter((source) => source.articleCount > 0).map((source) => (
                  <option key={source.sourceCode} value={source.sourceCode}>
                    {source.displayName} ({source.articleCount})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">{t("關鍵字", "Keywords")}</label>
              <div className="input-icon">
                <span className="input-icon-addon">
                  <IconSearch size={18} />
                </span>
                <input
                  className="form-control"
                  value={filters.keywords ?? ""}
                  onChange={(event) => onChange({ ...filters, keywords: event.target.value })}
                  placeholder={t("輸入關鍵字", "Enter keywords")}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="article-search-actions">
        <button
          className="btn btn-outline-secondary"
          type="button"
          onClick={() => onAdvancedOpenChange(!advancedOpen)}
        >
          <IconAdjustmentsHorizontal size={18} />
          {advancedOpen ? t("收合進階搜尋", "Hide Advanced Search") : t("進階搜尋", "Advanced Search")}
          <IconChevronDown className={advancedOpen ? "chevron-open" : ""} size={16} />
        </button>
        <div className="btn-list">
          <button type="button" className="btn btn-outline-secondary" onClick={onReset}>
            {t("重設", "Reset")}
          </button>
          <button type="submit" className="btn btn-primary">
            {t("搜尋", "Search")}
          </button>
        </div>
      </div>
    </form>
  );
}

function RawArticleModal({
  article,
  error,
  loading,
  onClose
}: {
  article: RawArticleResponse | null;
  error: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  const { language, t } = useI18n();
  return (
    <div className="modal modal-blur d-block" role="dialog" aria-modal="true">
      <div className="modal-dialog modal-xl modal-dialog-centered raw-modal" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h3 className="modal-title">{t("原始爬取文章", "Raw Captured Article")}</h3>
              {article && (
                <div className="text-secondary small">
                  {article.sourceName} · {t("新聞日期", "Published")}: {dateTime(article.publishedAt, language)}
                </div>
              )}
            </div>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {loading && <LoadingBlock />}
            {error && <ErrorBlock message={error} />}
            {article && !loading && !error && (
              <div className="raw-article">
                <h4 className="raw-title">{article.title}</h4>
                {article.contentPath && <div className="raw-path">{article.contentPath}</div>}
                {article.content ? (
                  <pre className="raw-content">{article.content}</pre>
                ) : (
                  <div className="missing-summary">{t("沒有可顯示的原始正文", "No raw article text is available")}</div>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {t("關閉", "Close")}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" onClick={onClose} />
    </div>
  );
}

function hasActiveFilters(filters: ArticleFilters) {
  return (
    filters.period !== "history" ||
    (filters.stableLabels?.length ?? 0) > 0 ||
    (filters.countryLabels?.length ?? 0) > 0 ||
    (filters.sources?.length ?? 0) > 0 ||
    Boolean(filters.keywords?.trim()) ||
    Boolean(filters.summaryText?.trim())
  );
}

function countryQuickLabels(options: OptionsResponse) {
  const codes = ["TAIWAN", "SOUTH_KOREA", "JAPAN", "CHINA", "REGIONAL"];
  return codes.flatMap((code) => options.countryLabels.find((label) => label.code === code) ?? []);
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function PeriodButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`btn ${active ? "btn-primary" : "btn-outline-primary"}`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
