import { useEffect, useState } from "react";
import { IconChartBar, IconSearch } from "@tabler/icons-react";
import { getOverview } from "../api";
import { labelText } from "../format";
import type { OverviewData } from "../types";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { MetricCard } from "../components/MetricCard";
import LabelSelector from "../components/LabelSelector";
import { MultiLabelLineChart, TotalLineChart } from "../components/Charts";
import { useI18n } from "../i18n";

const UNLABELED_CODE = "UNLABELED";

export default function OverviewPage() {
  const { language, t } = useI18n();
  const [range, setRange] = useState<"month" | "history">("month");
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stableSelected, setStableSelected] = useState<string[]>([]);
  const [countrySelected, setCountrySelected] = useState<string[]>([]);

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
        setStableSelected((current) => syncSelected(current, visibleLabels(payload.totals.stableLabels)));
        setCountrySelected((current) => syncSelected(current, visibleLabels(payload.totals.countryLabels)));
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

  return (
    <main className="page-body">
      <div className="container-xl">
        <div className="page-header d-print-none">
          <div className="row align-items-center">
            <div className="col">
              <h1 className="page-title">{t("總覽", "Overview")}</h1>
              <div className="text-secondary">
                {t(
                  "以新聞發布日期統計文章、穩定標籤與國家標籤",
                  "Article, stable label, and country label statistics by published date"
                )}
              </div>
            </div>
            <div className="col-auto">
              <div className="btn-list">
                <button
                  className={`btn ${range === "month" ? "btn-primary" : "btn-outline-primary"}`}
                  type="button"
                  onClick={() => setRange("month")}
                >
                  {t("本月", "This Month")}
                </button>
                <button
                  className={`btn ${range === "history" ? "btn-primary" : "btn-outline-primary"}`}
                  type="button"
                  onClick={() => setRange("history")}
                >
                  {t("歷史", "History")}
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
              <div className="col-sm-6 col-lg-4">
                <MetricCard
                  title={t("總掃描文章數", "Total Scanned Articles")}
                  value={data.totals.scannedArticles}
                  note={t("去重後有效掃描候選", "Deduplicated active scanned candidates")}
                  icon={<IconSearch size={24} />}
                />
              </div>
              <div className="col-sm-6 col-lg-4">
                <MetricCard
                  title={t("匹配文章數", "Matched Articles")}
                  value={data.totals.articles}
                  note={range === "month" ? t("本月發布", "Published this month") : t("完整歷史", "Full history")}
                  icon={<IconChartBar size={24} />}
                />
              </div>
            </div>

            <div className="row row-cards">
              <div className="col-lg-6">
                <LabelCountCard
                  title={t("各穩定標籤文章數", "Articles by Stable Label")}
                  labels={visibleLabels(data.totals.stableLabels)}
                  language={language}
                />
              </div>
              <div className="col-lg-6">
                <LabelCountCard
                  title={t("各國家標籤文章數", "Articles by Country Label")}
                  labels={visibleLabels(data.totals.countryLabels)}
                  language={language}
                />
              </div>
            </div>

            <ChartCard key={`total-${data.range}`} title={t("每日總文章數（依發布日期）", "Daily Total Articles by Published Date")}>
              <TotalLineChart data={data.daily.totalArticles} />
            </ChartCard>

            <ChartCard key={`stable-${data.range}`} title={t("每日各穩定標籤文章數（依發布日期）", "Daily Articles by Stable Label by Published Date")}>
              <LabelSelector
                labels={visibleLabels(data.options.stableLabels)}
                selected={stableSelected}
                onChange={setStableSelected}
                compact
              />
              <MultiLabelLineChart
                data={data.daily.stableLabels}
                labels={visibleLabels(data.options.stableLabels)}
                selected={stableSelected}
              />
            </ChartCard>

            <ChartCard key={`country-${data.range}`} title={t("每日各國家標籤文章數（依發布日期）", "Daily Articles by Country Label by Published Date")}>
              <LabelSelector
                labels={visibleLabels(data.options.countryLabels)}
                selected={countrySelected}
                onChange={setCountrySelected}
                compact
              />
              <MultiLabelLineChart
                data={data.daily.countryLabels}
                labels={visibleLabels(data.options.countryLabels)}
                selected={countrySelected}
              />
            </ChartCard>
          </div>
        )}
      </div>
    </main>
  );
}

function LabelCountCard({
  title,
  labels,
  language
}: {
  title: string;
  labels: Array<{ code: string; zh: string; en: string; count: number }>;
  language: "zh" | "en";
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
      </div>
      <div className="table-responsive">
        <table className="table table-vcenter card-table">
          <tbody>
            {labels.map((label) => (
              <tr key={label.code}>
                <td>
                  <span className="fw-medium">{labelText(label, language)}</span>
                  <div className="text-secondary small">{label.code}</div>
                </td>
                <td className="text-end">
                  <span className="badge bg-blue-lt">{label.count}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card chart-card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function defaultSelected(labels: Array<{ code: string; count: number }>) {
  const nonZero = labels.filter((label) => label.count > 0).map((label) => label.code);
  return nonZero.length > 0 ? nonZero.slice(0, 6) : labels.slice(0, 4).map((label) => label.code);
}

function visibleLabels<T extends { code: string }>(labels: T[]) {
  return labels.filter((label) => label.code !== UNLABELED_CODE);
}

function syncSelected(current: string[], labels: Array<{ code: string; count: number }>) {
  const visibleCodes = new Set(labels.map((label) => label.code));
  const synced = current.filter((code) => visibleCodes.has(code));
  return synced.length > 0 ? synced : defaultSelected(labels);
}
