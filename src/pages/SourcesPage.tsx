import { useEffect, useState } from "react";
import { IconExternalLink, IconFileDescription } from "@tabler/icons-react";
import { getMediaCandidates } from "../api";
import type { MediaCandidatesResponse } from "../types";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { useI18n } from "../i18n";

export default function SourcesPage() {
  const { language, t } = useI18n();
  const [data, setData] = useState<MediaCandidatesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMediaCandidates().then(setData).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="page-body">
      <div className="container-xl">
        <div className="page-header d-print-none">
          <div className="row align-items-center">
            <div className="col">
              <h1 className="page-title">{t("來源", "Source")}</h1>
              <div className="text-secondary">
                {t("呈現 media_candidates.md 的候選媒體清單", "Displays the candidate media list from media_candidates.md")}
              </div>
            </div>
          </div>
        </div>

        {error && <ErrorBlock message={error} />}
        {!error && !data && <LoadingBlock />}
        {data && (
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">{t("媒體候選清單", "Media Candidates")}</h2>
                <div className="text-secondary small">
                  {t("查核日期", "Checked Date")}: {data.checkedDate ?? t("未提供", "Not provided")}
                </div>
              </div>
              <div className="card-actions">
                <span className="badge bg-blue-lt">
                  {t("筆數", "Rows")}: {data.rows.length}
                </span>
              </div>
            </div>
            <div className="card-body source-path">
              <IconFileDescription size={18} />
              <span>{data.path}</span>
            </div>
            <div className="table-responsive source-table-wrap">
              <table className="table table-vcenter table-hover card-table source-table">
                <thead>
                  <tr>
                    <th>{t("地區/主要目標", "Target Region")}</th>
                    <th>{t("名稱", "Name")}</th>
                    <th>{t("主站 URL", "Homepage URL")}</th>
                    <th>{t("指認來源", "Attribution Source")}</th>
                    <th>{t("指認摘要與 Evidence URL", "Evidence Summary & URL")}</th>
                    <th>{t("URL 檢查", "URL Check")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => (
                    <tr key={`${row.name}-${index}`}>
                      <td className="text-nowrap">{row.targetRegion}</td>
                      <td>
                        <div className="fw-medium">{row.name}</div>
                        <div className="text-secondary small">{row.englishName}</div>
                        <div className="text-secondary small">{row.chineseName}</div>
                      </td>
                      <td>
                        <a href={row.homepageUrl} target="_blank" rel="noreferrer" className="source-link">
                          <span>{row.homepageUrl}</span>
                          <IconExternalLink size={15} />
                        </a>
                      </td>
                      <td>{row.attributionSource}</td>
                      <td className="evidence-cell">{linkify(row.evidenceSummary, language)}</td>
                      <td>
                        <span className={statusBadgeClass(row.urlCheck)}>{row.urlCheck}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function linkify(text: string, language: "zh" | "en") {
  const parts = text.split(/(https?:\/\/[^\s;]+)/g);
  return parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer">
          {language === "zh" ? `證據 ${index + 1}` : `Evidence ${index + 1}`}
        </a>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function statusBadgeClass(value: string) {
  if (value.includes("200")) {
    return "badge bg-green-lt";
  }
  if (value.includes("401") || value.includes("403") || value.includes("307")) {
    return "badge bg-yellow-lt";
  }
  return "badge bg-secondary-lt";
}
