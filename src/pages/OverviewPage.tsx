import { useEffect, useState, type CSSProperties } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { getAllArticles, getOverview } from "../api";
import { articleTitle, dateTime, labelText } from "../format";
import type { ArticleRecord, OverviewData } from "../types";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { MetricCard } from "../components/MetricCard";
import LabelSelector from "../components/LabelSelector";
import { MultiLabelLineChart, TotalLineChart, type LabelPointClick } from "../components/Charts";
import { assetUrl } from "../assets";
import { useI18n } from "../i18n";

const UNLABELED_CODE = "UNLABELED";
type OverviewRange = OverviewData["range"];
type ArticlePointModal = {
  date: string;
  title: string;
  loading: boolean;
  error: string | null;
  articles: ArticleRecord[];
};
type TrendValue = {
  countDelta: number;
  percentDelta: number;
};
type TrendMap = Record<string, TrendValue>;
type ComparisonTrends = {
  topic: TrendMap;
  country: TrendMap;
};

const COUNTRY_RELATED_LABELS = [
  { code: "TAIWAN_RELATED", zh: "台灣相關", en: "Taiwan-Related", memberCodes: ["TAIWAN", "TAIWAN_CHINA", "TAIWAN_JAPAN", "TAIWAN_SOUTH_KOREA"] },
  { code: "CHINA_RELATED", zh: "中國相關", en: "China-Related", memberCodes: ["CHINA", "TAIWAN_CHINA", "CHINA_JAPAN", "CHINA_SOUTH_KOREA"] },
  { code: "JAPAN_RELATED", zh: "日本相關", en: "Japan-Related", memberCodes: ["JAPAN", "TAIWAN_JAPAN", "CHINA_JAPAN", "JAPAN_SOUTH_KOREA"] },
  { code: "SOUTH_KOREA_RELATED", zh: "韓國相關", en: "South Korea-Related", memberCodes: ["SOUTH_KOREA", "TAIWAN_SOUTH_KOREA", "CHINA_SOUTH_KOREA", "JAPAN_SOUTH_KOREA"] },
  { code: "REGIONAL_RELATED", zh: "區域相關", en: "Regional-Related", memberCodes: ["REGIONAL"] }
];

const COUNTRY_SINGLE_MODE_COUNTRIES = [
  { relatedCode: "TAIWAN_RELATED", sourceCode: "TAIWAN", zh: "台灣", en: "Taiwan" },
  { relatedCode: "CHINA_RELATED", sourceCode: "CHINA", zh: "中國", en: "China" },
  { relatedCode: "JAPAN_RELATED", sourceCode: "JAPAN", zh: "日本", en: "Japan" },
  { relatedCode: "SOUTH_KOREA_RELATED", sourceCode: "SOUTH_KOREA", zh: "韓國", en: "South Korea" }
];

const COUNTRY_SINGLE_MODE_RELATIONS: Record<string, { code: string; zh: string; en: string; memberCodes: string[] }> = {
  CHINA_RELATED__TAIWAN_RELATED: { code: "PAIR_TAIWAN_CHINA", zh: "台中關係", en: "Taiwan-China Relations", memberCodes: ["TAIWAN_CHINA"] },
  JAPAN_RELATED__TAIWAN_RELATED: { code: "PAIR_TAIWAN_JAPAN", zh: "台日關係", en: "Taiwan-Japan Relations", memberCodes: ["TAIWAN_JAPAN"] },
  SOUTH_KOREA_RELATED__TAIWAN_RELATED: { code: "PAIR_TAIWAN_SOUTH_KOREA", zh: "台韓關係", en: "Taiwan-South Korea Relations", memberCodes: ["TAIWAN_SOUTH_KOREA"] },
  CHINA_RELATED__JAPAN_RELATED: { code: "PAIR_CHINA_JAPAN", zh: "日中關係", en: "Japan-China Relations", memberCodes: ["CHINA_JAPAN"] },
  CHINA_RELATED__SOUTH_KOREA_RELATED: { code: "PAIR_CHINA_SOUTH_KOREA", zh: "韓中關係", en: "South Korea-China Relations", memberCodes: ["CHINA_SOUTH_KOREA"] },
  JAPAN_RELATED__SOUTH_KOREA_RELATED: { code: "PAIR_JAPAN_SOUTH_KOREA", zh: "日韓關係", en: "Japan-South Korea Relations", memberCodes: ["JAPAN_SOUTH_KOREA"] }
};

export default function OverviewPage() {
  const { language, t } = useI18n();
  const [range, setRange] = useState<OverviewRange>("history");
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stableSelected, setStableSelected] = useState<string[]>([]);
  const [countrySelected, setCountrySelected] = useState<string[]>([]);
  const [countryChartSingleMode, setCountryChartSingleMode] = useState(false);
  const [bilateralExpanded, setBilateralExpanded] = useState(false);
  const [allArticles, setAllArticles] = useState<ArticleRecord[] | null>(null);
  const [articlePointModal, setArticlePointModal] = useState<ArticlePointModal | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    getOverview(range)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setData(payload);
        setStableSelected((current) => syncSelected(current, visibleLabels(payload.totals.stableLabels), ["SECURITY_DEFENSE"]));
        setCountrySelected((current) => syncSelected(current, COUNTRY_RELATED_LABELS, ["CHINA_RELATED"]));
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  useEffect(() => {
    if (range === "history" || allArticles) {
      return;
    }
    let cancelled = false;
    getAllArticles()
      .then((articles) => {
        if (!cancelled) {
          setAllArticles(articles);
        }
      })
      .catch(() => {
        // Trend annotations are optional; keep the overview usable if article loading fails.
      });
    return () => {
      cancelled = true;
    };
  }, [allArticles, range]);

  const countryChart = data
    ? buildCountryChart(data.daily.countryLabels, countrySelected, countryChartSingleMode)
    : null;
  const comparisonTrends = data && allArticles ? buildComparisonTrends(allArticles, range) : null;

  async function openArticlePointModal({
    date,
    title,
    matches
  }: {
    date: string;
    title: string;
    matches: (article: ArticleRecord) => boolean;
  }) {
    setArticlePointModal({ date, title, loading: true, error: null, articles: [] });
    try {
      const articles = allArticles ?? await getAllArticles();
      if (!allArticles) {
        setAllArticles(articles);
      }
      setArticlePointModal({
        date,
        title,
        loading: false,
        error: null,
        articles: articles.filter((article) => publishedDatePart(article) === date && matches(article))
      });
    } catch (err) {
      setArticlePointModal({
        date,
        title,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
        articles: []
      });
    }
  }

  function openStableArticles(point: LabelPointClick) {
    const labels = data
      ? visibleLabels(data.options.stableLabels).filter((item) => point.labelCodes.includes(item.code))
      : [];
    void openArticlePointModal({
      date: point.date,
      title: labels.length > 0
        ? labels.map((label) => labelText(label, language)).join(" / ")
        : labelText(null, language),
      matches: (article) => article.issueLabels.some((item) => point.labelCodes.includes(item.code))
    });
  }

  function openCountryArticles(point: LabelPointClick) {
    const chartLabels = countryChart?.labels.filter((item) => point.labelCodes.includes(item.code)) ?? [];
    const memberCodes = unique(point.labelCodes.flatMap((code) => countryChart?.memberCodes[code] ?? []));
    void openArticlePointModal({
      date: point.date,
      title: chartLabels.length > 0
        ? chartLabels.map((label) => labelText(label, language)).join(" / ")
        : labelText(null, language),
      matches: (article) => Boolean(article.countryLabel && memberCodes.includes(article.countryLabel.code))
    });
  }

  return (
    <main className="page-body">
      <div className="container-xl">
        <div className="page-toolbar d-print-none">
          <div className="row align-items-center justify-content-end">
            <div className="col-auto">
              <div className="btn-list">
                <button
                  className={`btn ${range === "history" ? "btn-primary" : "btn-outline-primary"}`}
                  type="button"
                  onClick={() => setRange("history")}
                >
                  {t("全部", "All")}
                </button>
                <RangeButton
                  active={range === "week"}
                  label={t("本週", "This Week")}
                  onClick={() => setRange("week")}
                />
                <button
                  className={`btn ${range === "month" ? "btn-primary" : "btn-outline-primary"}`}
                  type="button"
                  onClick={() => setRange("month")}
                >
                  {t("本月", "This Month")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && <ErrorBlock message={error} />}
        {!error && !data && <LoadingBlock />}
        {data && (
          <div className="dashboard-stack">
            <div className="row row-cards">
              {range === "history" && (
                <div className="col-sm-6 col-lg-4">
                  <MetricCard
                    title={t("總掃描新聞數", "Total Scanned News")}
                    value={data.totals.scannedArticles}
                  />
                </div>
              )}
              <div className="col-sm-6 col-lg-4">
                <MetricCard
                  title={t("東亞相關新聞數", "East Asia-Related News")}
                  value={data.totals.articles}
                  note={matchedNewsNote(range, data.totals.articles, data.totals.scannedArticles, t)}
                />
              </div>
            </div>

            <div className="row row-cards">
              <div className="col-lg-6">
                <LabelCountCard
                  title={t("主題", "Topics")}
                  labels={visibleLabels(data.totals.stableLabels)}
                  denominator={sumCounts(visibleLabels(data.totals.stableLabels))}
                  language={language}
                  trends={comparisonTrends?.topic}
                />
              </div>
              <div className="col-lg-6">
                <CountryCountCard
                  title={t("國家", "Countries")}
                  labels={visibleLabels(data.totals.countryLabels)}
                  denominator={data.totals.articles}
                  expanded={bilateralExpanded}
                  onExpandedChange={setBilateralExpanded}
                  trends={comparisonTrends?.country}
                />
              </div>
            </div>

            <ChartCard key={`total-${data.range}`} title={t("每日總文章數", "Daily Total Articles")}>
              <TotalLineChart data={data.daily.totalArticles} height={160} />
            </ChartCard>

            <ChartCard key={`stable-${data.range}`} title={t("每日主題新聞數（可點擊顯示新聞清單）", "Daily News by Topic (click to show news list)")}>
              <div className="chart-selector-row">
                <LabelSelector
                  labels={visibleLabels(data.options.stableLabels)}
                  selected={stableSelected}
                  onChange={setStableSelected}
                  compact
                />
                <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setStableSelected([])}>
                  {t("取消全選", "Clear All")}
                </button>
              </div>
              <MultiLabelLineChart
                data={data.daily.stableLabels}
                labels={visibleLabels(data.options.stableLabels)}
                onPointClick={openStableArticles}
                selected={stableSelected}
              />
            </ChartCard>

            <ChartCard
              action={
                <button
                  className={`btn btn-sm ${countryChartSingleMode ? "btn-primary" : "btn-outline-primary"}`}
                  type="button"
                  onClick={() => setCountryChartSingleMode((current) => !current)}
                >
                  {t("僅顯示單一國家新聞（勾選兩國顯示雙邊關係）", "Single-country news only; two selected countries show bilateral relations")}
                </button>
              }
              key={`country-${data.range}`}
              title={t("每日國家相關新聞數（可點擊顯示新聞清單）", "Daily Country-Related News (click to show news list)")}
            >
              <div className="chart-selector-row">
                <LabelSelector
                  labels={COUNTRY_RELATED_LABELS}
                  selected={countrySelected}
                  onChange={setCountrySelected}
                  compact
                />
                <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setCountrySelected([])}>
                  {t("取消全選", "Clear All")}
                </button>
              </div>
              <MultiLabelLineChart
                data={countryChart?.data ?? []}
                labels={countryChart?.labels ?? []}
                onPointClick={openCountryArticles}
                selected={countryChart?.selected ?? []}
              />
            </ChartCard>
          </div>
        )}
      </div>
      {articlePointModal && (
        <ArticlePointModalView
          modal={articlePointModal}
          onClose={() => setArticlePointModal(null)}
        />
      )}
    </main>
  );
}

function RangeButton({
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

function rangeNote(range: OverviewRange, t: (zh: string, en: string) => string) {
  if (range === "week") {
    return t("本週發布", "Published this week");
  }
  if (range === "month") {
    return t("本月發布", "Published this month");
  }
  return t("全部文章", "All articles");
}

function matchedNewsNote(
  range: OverviewRange,
  matchedCount: number,
  scannedCount: number,
  t: (zh: string, en: string) => string
) {
  if (range !== "history") {
    return rangeNote(range, t);
  }
  return t(
    `佔總掃描新聞數 ${formatPercent(matchedCount, scannedCount)}`,
    `${formatPercent(matchedCount, scannedCount)} of total scanned news`
  );
}

function LabelCountCard({
  title,
  labels,
  denominator,
  language,
  trends
}: {
  title: string;
  labels: Array<{ code: string; zh: string; en: string; count: number }>;
  denominator: number;
  language: "zh" | "en";
  trends?: TrendMap;
}) {
  const sortedLabels = [...labels].sort((left, right) => right.count - left.count);
  const maxCount = Math.max(1, ...sortedLabels.map((label) => label.count));
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
      </div>
      <div className="table-responsive">
        <table className="table table-vcenter card-table topic-table">
          <thead>
            <tr>
              <th>{title}</th>
              <th className="text-end">{language === "zh" ? "篇數" : "Articles"}</th>
              <th className="text-end">{language === "zh" ? "比例" : "Share"}</th>
            </tr>
          </thead>
          <tbody>
            {sortedLabels.map((label) => (
              <tr className="topic-row" key={label.code} style={fieldBackgroundStyle(label.code)}>
                <td>
                  <div className="topic-label-cell">
                    <span className="fw-medium">{labelText(label, language)}</span>
                    <span
                      className="topic-bar"
                      style={{ width: `${(label.count / maxCount) * 100}%` }}
                    />
                  </div>
                </td>
                <td className="text-end topic-count-cell">
                  <span className="badge bg-blue-lt">{label.count}</span>
                  <TrendBadge metric="count" trend={trends?.[label.code]} />
                </td>
                <td className="text-end text-secondary topic-percent-cell">
                  {formatPercent(label.count, denominator)}
                  <TrendBadge metric="percent" trend={trends?.[label.code]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CountryCountCard({
  title,
  labels,
  denominator,
  expanded,
  onExpandedChange,
  trends
}: {
  title: string;
  labels: Array<{ code: string; zh: string; en: string; count: number }>;
  denominator: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  trends?: TrendMap;
}) {
  const { t } = useI18n();
  const counts = new Map(labels.map((label) => [label.code, label.count]));
  const bilateralCodes = [
    "TAIWAN_JAPAN",
    "TAIWAN_SOUTH_KOREA",
    "TAIWAN_CHINA",
    "JAPAN_SOUTH_KOREA",
    "CHINA_JAPAN",
    "CHINA_SOUTH_KOREA"
  ];
  const singleCountryItems = [
    { key: "TAIWAN", label: t("台灣", "Taiwan"), count: counts.get("TAIWAN") ?? 0 },
    { key: "CHINA", label: t("中國", "China"), count: counts.get("CHINA") ?? 0 },
    { key: "JAPAN", label: t("日本", "Japan"), count: counts.get("JAPAN") ?? 0 },
    { key: "SOUTH_KOREA", label: t("韓國", "South Korea"), count: counts.get("SOUTH_KOREA") ?? 0 }
  ].sort(sortByCountDesc);
  const bilateralCount = bilateralCodes.reduce((total, code) => total + (counts.get(code) ?? 0), 0);
  const regionalCount = counts.get("REGIONAL") ?? 0;
  const bilateralItems = [
    { key: "TAIWAN_JAPAN", label: t("台日", "TW-JP"), count: counts.get("TAIWAN_JAPAN") ?? 0 },
    { key: "TAIWAN_SOUTH_KOREA", label: t("台韓", "TW-KR"), count: counts.get("TAIWAN_SOUTH_KOREA") ?? 0 },
    { key: "TAIWAN_CHINA", label: t("台中", "TW-CN"), count: counts.get("TAIWAN_CHINA") ?? 0 },
    { key: "JAPAN_SOUTH_KOREA", label: t("日韓", "JP-KR"), count: counts.get("JAPAN_SOUTH_KOREA") ?? 0 },
    { key: "CHINA_JAPAN", label: t("日中", "JP-CN"), count: counts.get("CHINA_JAPAN") ?? 0 },
    { key: "CHINA_SOUTH_KOREA", label: t("韓中", "KR-CN"), count: counts.get("CHINA_SOUTH_KOREA") ?? 0 }
  ].sort(sortByCountDesc);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
      </div>
      <div className="card-body">
        <div className="country-grid country-single-grid">
          {singleCountryItems.map((item) => (
            <CountryStatCell
              className="country-square-cell"
              count={item.count}
              denominator={denominator}
              fieldCode={item.key}
              key={item.key}
              label={item.label}
              trend={trends?.[item.key]}
            />
          ))}
        </div>
        <div className="country-wide-stack">
          <button
            className={`country-wide-cell country-cell-button ${expanded ? "active" : ""}`}
            style={fieldBackgroundStyle("BILATERAL")}
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            aria-expanded={expanded}
          >
            <CountryStatCellContent
              count={bilateralCount}
              denominator={denominator}
              label={t("雙邊關係", "Bilateral Relations")}
              trend={trends?.BILATERAL}
            />
            <IconChevronDown className="country-expand-icon" size={18} />
          </button>
          {expanded && (
            <div className="country-subgrid">
              {bilateralItems.map((item) => {
                return (
                  <CountryStatCell
                    className="country-subcell"
                    count={item.count}
                    denominator={denominator}
                    fieldCode={item.key}
                    key={item.key}
                    label={item.label}
                    trend={trends?.[item.key]}
                  />
                );
              })}
            </div>
          )}
          <CountryStatCell
            className="country-wide-cell"
            count={regionalCount}
            denominator={denominator}
            fieldCode="REGIONAL"
            label={t("區域關係", "Regional Relations")}
            trend={trends?.REGIONAL}
          />
        </div>
      </div>
    </div>
  );
}

function CountryStatCell({
  label,
  count,
  denominator,
  className = "",
  inlineMetric = false,
  trend,
  fieldCode
}: {
  label: string;
  count: number;
  denominator: number;
  className?: string;
  inlineMetric?: boolean;
  trend?: TrendValue;
  fieldCode?: string;
}) {
  return (
    <div className={`country-cell ${className}`} style={fieldBackgroundStyle(fieldCode)}>
      <CountryStatCellContent
        label={label}
        count={count}
        denominator={denominator}
        inlineMetric={inlineMetric}
        trend={trend}
      />
    </div>
  );
}

function CountryStatCellContent({
  label,
  count,
  denominator,
  inlineMetric = false,
  trend
}: {
  label: string;
  count: number;
  denominator: number;
  inlineMetric?: boolean;
  trend?: TrendValue;
}) {
  if (inlineMetric) {
    return (
      <>
        <span className="country-label">{label}</span>
        <span className="country-inline-metric">
          <span className="country-count">{count}</span>
          <TrendBadge metric="count" trend={trend} />
          <span className="country-percent">{formatPercent(count, denominator)}</span>
          <TrendBadge metric="percent" trend={trend} />
        </span>
      </>
    );
  }
  return (
    <>
      <span className="country-label">{label}</span>
      <span className="country-count">
        {count}
        <TrendBadge metric="count" trend={trend} />
      </span>
      <span className="country-percent">
        {formatPercent(count, denominator)}
        <TrendBadge metric="percent" trend={trend} />
      </span>
    </>
  );
}

function TrendBadge({
  trend,
  metric
}: {
  trend?: TrendValue;
  metric: "count" | "percent";
}) {
  if (!trend) {
    return null;
  }
  const value = metric === "count" ? trend.countDelta : trend.percentDelta;
  if (value === 0) {
    return null;
  }
  const isIncrease = value > 0;
  return (
    <span
      className={`trend-badge ${isIncrease ? "trend-up" : "trend-down"}`}
    >
      {isIncrease ? "▲" : "▼"}
      <span className="trend-tooltip">
        {metric === "count" ? formatSignedInteger(value) : formatSignedPercentChange(value)}
      </span>
    </span>
  );
}

function ArticlePointModalView({
  modal,
  onClose
}: {
  modal: ArticlePointModal;
  onClose: () => void;
}) {
  const { language, t } = useI18n();
  return (
    <div className="modal modal-blur d-block" role="dialog" aria-modal="true">
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h3 className="modal-title">{modal.title}</h3>
              <div className="text-secondary small">
                {t("日期", "Date")}: {modal.date}
              </div>
            </div>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {modal.loading && <LoadingBlock />}
            {modal.error && <ErrorBlock message={modal.error} />}
            {!modal.loading && !modal.error && (
              modal.articles.length > 0 ? (
                <div className="point-article-list">
                  {modal.articles.map((article) => (
                    <a
                      className="point-article-item"
                      href={article.canonicalUrl}
                      key={article.articleId}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="point-article-title">{articleTitle(article, language)}</span>
                      <span className="point-article-meta">
                        {article.sourceName} · {dateTime(article.publishedAt, language)}
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <p className="empty-title">{t("沒有對應文章", "No Matching Articles")}</p>
                </div>
              )
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

function ChartCard({
  title,
  children,
  action
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card chart-card">
      <div className="card-header chart-card-header">
        <h2 className="card-title">{title}</h2>
        {action && <div className="chart-card-action">{action}</div>}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function visibleLabels<T extends { code: string }>(labels: T[]) {
  return labels.filter((label) => label.code !== UNLABELED_CODE);
}

function syncSelected(current: string[], labels: Array<{ code: string; count?: number }>, preferredCodes: string[]) {
  const visibleCodes = new Set(labels.map((label) => label.code));
  const synced = current.filter((code) => visibleCodes.has(code));
  if (synced.length > 0) {
    return synced;
  }
  const preferred = preferredCodes.filter((code) => visibleCodes.has(code));
  return preferred.length > 0 ? preferred : labels.slice(0, 4).map((label) => label.code);
}

function buildCountryChart(
  daily: OverviewData["daily"]["countryLabels"],
  selected: string[],
  singleMode: boolean
) {
  const labels = singleMode ? buildCountrySingleModeLabels(selected) : COUNTRY_RELATED_LABELS;
  const data = daily.map((item) => ({
    date: item.date,
    counts: Object.fromEntries(
      labels.map((label) => [
        label.code,
        label.memberCodes.reduce((total, code) => total + (item.counts[code] ?? 0), 0)
      ])
    )
  }));
  return {
    data,
    labels: labels.map(({ memberCodes: _memberCodes, ...label }) => label),
    memberCodes: Object.fromEntries(labels.map((label) => [label.code, label.memberCodes])),
    selected: singleMode ? labels.map((label) => label.code) : selected
  };
}

function buildCountrySingleModeLabels(selected: string[]) {
  const selectedCountries = COUNTRY_SINGLE_MODE_COUNTRIES.filter((country) => selected.includes(country.relatedCode));
  const labels: Array<{ code: string; zh: string; en: string; memberCodes: string[] }> = [];

  if (selectedCountries.length === 1) {
    const country = selectedCountries[0];
    labels.push({
      code: `SINGLE_${country.sourceCode}`,
      zh: country.zh,
      en: country.en,
      memberCodes: [country.sourceCode]
    });
  } else if (selectedCountries.length === 2) {
    const pair = relationPair(selectedCountries[0].relatedCode, selectedCountries[1].relatedCode);
    if (pair) {
      labels.push(pair);
    }
  }

  if (selected.includes("REGIONAL_RELATED")) {
    labels.push({
      code: "SINGLE_REGIONAL",
      zh: "區域相關",
      en: "Regional-Related",
      memberCodes: ["REGIONAL"]
    });
  }

  return labels;
}

function relationPair(left: string, right: string) {
  const key = [left, right].sort().join("__");
  return COUNTRY_SINGLE_MODE_RELATIONS[key] ?? null;
}

function buildComparisonTrends(articles: ArticleRecord[], range: OverviewRange): ComparisonTrends | null {
  const bounds = comparisonBounds(range);
  if (!bounds) {
    return null;
  }
  const currentArticles = filterArticlesByDateRange(articles, bounds.currentStart, bounds.currentEnd);
  const previousArticles = filterArticlesByDateRange(articles, bounds.previousStart, bounds.previousEnd);
  const currentTopics = topicPeriodStats(currentArticles);
  const previousTopics = topicPeriodStats(previousArticles);
  const currentCountries = countryPeriodStats(currentArticles);
  const previousCountries = countryPeriodStats(previousArticles);

  return {
    topic: buildTrendMap([...new Set([
      ...Object.keys(currentTopics.counts),
      ...Object.keys(previousTopics.counts)
    ])], currentTopics, previousTopics),
    country: buildTrendMap([
      "TAIWAN",
      "CHINA",
      "JAPAN",
      "SOUTH_KOREA",
      "BILATERAL",
      "REGIONAL",
      "TAIWAN_JAPAN",
      "TAIWAN_SOUTH_KOREA",
      "TAIWAN_CHINA",
      "JAPAN_SOUTH_KOREA",
      "CHINA_JAPAN",
      "CHINA_SOUTH_KOREA"
    ], currentCountries, previousCountries)
  };
}

function comparisonBounds(range: OverviewRange) {
  const now = new Date();
  if (range === "week") {
    const currentStart = startOfWeek(now);
    return {
      currentStart,
      currentEnd: addDays(currentStart, 7),
      previousStart: addDays(currentStart, -7),
      previousEnd: currentStart
    };
  }
  if (range === "month") {
    const currentStart = startOfMonth(now);
    return {
      currentStart,
      currentEnd: addMonths(currentStart, 1),
      previousStart: addMonths(currentStart, -1),
      previousEnd: currentStart
    };
  }
  return null;
}

function filterArticlesByDateRange(articles: ArticleRecord[], start: Date, end: Date) {
  const startPart = formatDatePart(start);
  const endPart = formatDatePart(end);
  return articles.filter((article) => {
    const date = publishedDatePart(article);
    return date !== null && date >= startPart && date < endPart;
  });
}

function topicPeriodStats(articles: ArticleRecord[]) {
  const counts: Record<string, number> = {};
  let denominator = 0;
  for (const article of articles) {
    for (const label of article.issueLabels) {
      counts[label.code] = (counts[label.code] ?? 0) + 1;
      denominator += 1;
    }
  }
  return { counts, denominator };
}

function countryPeriodStats(articles: ArticleRecord[]) {
  const counts: Record<string, number> = {};
  for (const article of articles) {
    const code = article.countryLabel?.code;
    if (code) {
      counts[code] = (counts[code] ?? 0) + 1;
    }
  }
  counts.BILATERAL = [
    "TAIWAN_JAPAN",
    "TAIWAN_SOUTH_KOREA",
    "TAIWAN_CHINA",
    "JAPAN_SOUTH_KOREA",
    "CHINA_JAPAN",
    "CHINA_SOUTH_KOREA"
  ].reduce((total, code) => total + (counts[code] ?? 0), 0);
  return { counts, denominator: articles.length };
}

function buildTrendMap(
  codes: string[],
  current: { counts: Record<string, number>; denominator: number },
  previous: { counts: Record<string, number>; denominator: number }
) {
  return Object.fromEntries(codes.map((code) => {
    const currentCount = current.counts[code] ?? 0;
    const previousCount = previous.counts[code] ?? 0;
    return [code, {
      countDelta: currentCount - previousCount,
      percentDelta: percentValue(currentCount, current.denominator) - percentValue(previousCount, previous.denominator)
    }];
  }));
}

function sumCounts(labels: Array<{ count: number }>) {
  return labels.reduce((total, label) => total + label.count, 0);
}

function formatPercent(count: number, denominator: number) {
  if (denominator <= 0) {
    return "0%";
  }
  const percentage = (count / denominator) * 100;
  return `${percentage >= 10 ? percentage.toFixed(0) : percentage.toFixed(1)}%`;
}

function percentValue(count: number, denominator: number) {
  return denominator > 0 ? (count / denominator) * 100 : 0;
}

function formatSignedInteger(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function formatSignedPercentChange(value: number) {
  const abs = Math.abs(value);
  const formatted = abs >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${value > 0 ? "+" : ""}${formatted}%`;
}

function sortByCountDesc<T extends { count: number; key: string }>(left: T, right: T) {
  return right.count - left.count || left.key.localeCompare(right.key);
}

const FIELD_BACKGROUND_ASSETS: Record<string, string> = {
  SECURITY_DEFENSE: "topic-security-defense",
  DIPLOMACY: "topic-diplomacy",
  ECONOMY_TRADE: "topic-economy-trade",
  TECHNOLOGY: "topic-technology",
  ENERGY_RESOURCES: "topic-energy-resources",
  DOMESTIC_POLITICS: "topic-domestic-politics",
  LAW_GOVERNANCE: "topic-law-governance",
  PUBLIC_HEALTH: "topic-public-health",
  SOCIETY_CULTURE: "topic-society-culture",
  ENVIRONMENT_DISASTER: "topic-environment-disaster",
  TAIWAN: "country-taiwan",
  CHINA: "country-china",
  JAPAN: "country-japan",
  SOUTH_KOREA: "country-south-korea",
  BILATERAL: "country-bilateral",
  TAIWAN_JAPAN: "country-taiwan-japan",
  TAIWAN_SOUTH_KOREA: "country-taiwan-south-korea",
  TAIWAN_CHINA: "country-taiwan-china",
  JAPAN_SOUTH_KOREA: "country-japan-south-korea",
  CHINA_JAPAN: "country-china-japan",
  CHINA_SOUTH_KOREA: "country-china-south-korea",
  REGIONAL: "country-regional"
};

function fieldBackgroundStyle(code: string | undefined) {
  if (!code) {
    return undefined;
  }
  const asset = FIELD_BACKGROUND_ASSETS[code];
  if (!asset) {
    return undefined;
  }
  return {
    "--field-bg": `url("${assetUrl(`assets/field-backgrounds/${asset}.png`)}")`
  } as CSSProperties;
}

function publishedDatePart(article: Pick<ArticleRecord, "publishedAt">) {
  if (!article.publishedAt) {
    return null;
  }
  return /^(\d{4}-\d{2}-\d{2})/.exec(article.publishedAt)?.[1] ?? null;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();
  result.setDate(result.getDate() - ((day + 6) % 7));
  return result;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatDatePart(date: Date) {
  return [
    date.getFullYear(),
    `${date.getMonth() + 1}`.padStart(2, "0"),
    `${date.getDate()}`.padStart(2, "0")
  ].join("-");
}
