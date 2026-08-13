import { useNavigate, useParams } from "react-router-dom";
import { Banner } from "../components/Banner";
import { SiteLoader } from "../components/Loader";
import { Sidebar } from "../components/Sidebar";
import { Stage } from "../components/Stage";
import { useI18n } from "../i18n";
import { useSite, useSiteReady } from "../store";

export function SitePage() {
  const data = useSite();
  const ready = useSiteReady();
  const { id } = useParams();
  const navigate = useNavigate();
  const { locale, setLocale, t } = useI18n();
  const article = id ? data.publications.find((p) => p.id === id) : undefined;
  const open = Boolean(article);

  if (!ready) {
    return <SiteLoader />;
  }

  return (
    <div className="page">
      <div className="site">
        {!open && <Banner data={data.banner} variant="hero" />}
        <Sidebar
          data={data}
          articleOpen={open}
          activeId={article?.id}
          onOpenArticle={(next) => navigate(`/p/${next}`)}
          onHome={() => navigate("/")}
        />
        {open && <Stage banner={data.banner} article={article} onClose={() => navigate("/")} />}
        {open && article && (
          <div className="mobile-sheet">
            <Stage banner={data.banner} article={article} onClose={() => navigate("/")} />
          </div>
        )}
        <div className="page-footer">
          <p>
            <button
              type="button"
              className="lang-switch"
              onClick={() => setLocale(locale === "en" ? "ru" : "en")}
            >
              {locale === "en" ? "EN" : "RU"}
            </button>
            <span className="lang-dot"> · </span>
            {t("© LEDNIQUE — 2026. All Rights Reserved.", "© LEDNIQUE — 2026. Все права защищены.")}
          </p>
        </div>
      </div>
    </div>
  );
}
