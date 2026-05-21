import { useEffect, useState } from "react";
import { IconChartLine, IconFileText, IconRefresh, IconTable } from "@tabler/icons-react";
import OverviewPage from "./pages/OverviewPage";
import ArticlesPage from "./pages/ArticlesPage";
import SourcesPage from "./pages/SourcesPage";
import { assetUrl } from "./assets";
import { useI18n } from "./i18n";

type PageKey = "overview" | "articles" | "sources";

const navItems: Array<{
  key: PageKey;
  zh: string;
  en: string;
  icon: typeof IconChartLine;
}> = [
  { key: "overview", zh: "總覽", en: "Overview", icon: IconChartLine },
  { key: "articles", zh: "新聞索引", en: "News Index", icon: IconFileText },
  { key: "sources", zh: "來源", en: "Source", icon: IconTable }
];

export default function App() {
  const { language, setLanguage, t } = useI18n();
  const [page, setPage] = useState<PageKey>(pageFromHash());

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function navigate(nextPage: PageKey) {
    window.location.hash = nextPage;
    setPage(nextPage);
  }

  return (
    <div className="page">
      <header className="navbar navbar-expand-md d-print-none app-navbar">
        <div className="container-xl">
          <div className="navbar-brand navbar-brand-autodark pe-0 pe-md-3">
            <img
              className="brand-visual"
              src={assetUrl("assets/brand/observatory-masthead-flat.png")}
              alt={t("俄羅斯關聯東亞媒體觀測站", "Russia-Linked East Asia Media Observatory")}
            />
          </div>
          <div className="navbar-nav flex-row order-md-last">
            <div className="btn-list me-2">
              <button
                className={`btn btn-sm ${language === "zh" ? "btn-primary" : "btn-outline-primary"}`}
                type="button"
                onClick={() => setLanguage("zh")}
              >
                中文
              </button>
              <button
                className={`btn btn-sm ${language === "en" ? "btn-primary" : "btn-outline-primary"}`}
                type="button"
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
            </div>
            <button
              className="btn btn-outline-secondary btn-icon"
              type="button"
              aria-label={t("重新整理", "Refresh")}
              title={t("重新整理", "Refresh")}
              onClick={() => window.location.reload()}
            >
              <IconRefresh size={18} />
            </button>
          </div>
          <div className="collapse navbar-collapse show">
            <div className="navbar-nav">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`nav-link btn btn-link ${page === item.key ? "active" : ""}`}
                    onClick={() => navigate(item.key)}
                    >
                    <span className="nav-link-icon d-md-none d-lg-inline-block">
                      <Icon size={18} />
                    </span>
                    <span className="nav-link-title">{t(item.zh, item.en)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="page-wrapper">
        {page === "overview" && <OverviewPage />}
        {page === "articles" && <ArticlesPage />}
        {page === "sources" && <SourcesPage />}
      </div>
    </div>
  );
}

function pageFromHash(): PageKey {
  const hash = window.location.hash.replace("#", "");
  if (hash === "articles" || hash === "sources" || hash === "overview") {
    return hash;
  }
  return "overview";
}
