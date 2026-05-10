import { useEffect, useMemo, useState } from "react";
import { IconChartBar, IconChartLine, IconSearch, IconTags } from "@tabler/icons-react";
import { getOverview } from "../api";
import { labelText } from "../format";
import type { OverviewData } from "../types";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { MetricCard } from "../components/MetricCard";
import LabelSelector from "../components/LabelSelector";
import { MultiLabelLineChart, TotalLineChart } from "../components/Charts";
import { useI18n } from "../i18n";

export default function OverviewPage() {
  const { language, t } = useI18n();
  const [range, setRange] = useState<"month" | "history">("month");
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stableSelected, setStableSelected] = useState<string[]>([]);
  const [countrySelected, setCountrySelected] = useState<string[]>([]);

  useEffect(() => {
    setError(null);
    getOverview(range)
      .then((payload) => {
        setData(payload);
        setStableSelected((current) =>
          current.length > 0 ? current : defaultSelected(payload.totals.stableLabels)
        );
        setCountrySelected((current) =>
          current.length > 0 ? current : defaultSelected(payload.totals.countryLabels)
        );
      })
      .catch((err: Error) => setError(err.message));
  }, [range]);

  const stableCounts = useMemo(
    () => data?.totals.stableLabels.filter((label) => label.count > 0) ?? [],
    [data]
  );
  const countryCounts = useMemo(
    () => data?.totals.countryLabels.filter((label) => label.count > 0) ?? [],
    [data]
  );

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
              <div className="col-sm-6 col-lg-3">
                <MetricCard
                  title={t("總掃描文章數", "Total Scanned Articles")}
                  value={data.totals.scannedArticles}
                  note={t("含已匹配與隔離候選", "Includes matched and quarantined candidates")}
                  icon={<IconSearch size={24} />}
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <MetricCard
                  title={t("匹配文章數", "Matched Articles")}
                  value={data.totals.articles}
                  note={range === "month" ? t("本月發布", "Published this month") : t("完整歷史", "Full history")}
                  icon={<IconChartBar size={24} />}
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <MetricCard
                  title={t("有資料的穩定標籤", "Stable Labels With Data")}
                  value={stableCounts.length}
                  note={t("不含零筆標籤", "Excludes zero-count labels")}
                  icon={<IconTags size={24} />}
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <MetricCard
                  title={t("有資料的國家標籤", "Country Labels With Data")}
                  value={countryCounts.length}
                  note={t("不含零筆標籤", "Excludes zero-count labels")}
                  icon={<IconChartLine size={24} />}
                />
              </div>
            </div>

            <div className="row row-cards">
              <div className="col-lg-6">
                <LabelCountCard
                  title={t("各穩定標籤文章數", "Articles by Stable Label")}
                  labels={data.totals.stableLabels}
                  language={language}
                />
              </div>
              <div className="col-lg-6">
                <LabelCountCard
                  title={t("各國家標籤文章數", "Articles by Country Label")}
                  labels={data.totals.countryLabels}
                  language={language}
                />
              </div>
            </div>

            <ChartCard title={t("每週總文章數（依發布日期）", "Weekly Total Articles by Published Date")}>
              <TotalLineChart data={data.weekly.totalArticles} />
            </ChartCard>

            <ChartCard title={t("每週各穩定標籤文章數（依發布日期）", "Weekly Articles by Stable Label by Published Date")}>
              <LabelSelector
                labels={data.options.stableLabels}
                selected={stableSelected}
                onChange={setStableSelected}
                compact
              />
              <MultiLabelLineChart
                data={data.weekly.stableLabels}
                labels={data.options.stableLabels}
                selected={stableSelected}
              />
            </ChartCard>

            <ChartCard title={t("每週各國家標籤文章數（依發布日期）", "Weekly Articles by Country Label by Published Date")}>
              <LabelSelector
                labels={data.options.countryLabels}
                selected={countrySelected}
                onChange={setCountrySelected}
                compact
              />
              <MultiLabelLineChart
                data={data.weekly.countryLabels}
                labels={data.options.countryLabels}
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
