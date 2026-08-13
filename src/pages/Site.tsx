import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Banner } from "../components/Banner";
import { SiteLoader } from "../components/Loader";
import { MenuPanel } from "../components/MenuPanel";
import { Sidebar } from "../components/Sidebar";
import { Stage } from "../components/Stage";
import { MENU_PAGES } from "../defaults";
import { useI18n } from "../i18n";
import { useSite, useSiteReady } from "../store";
import type { MenuPageKey, PageContent, Publication } from "../types";

const MENU_KEYS = new Set<string>(MENU_PAGES.map((p) => p.key));

/** Путь сквиркла (суперэллипс, n≈4) в координатах objectBoundingBox (0..1). */
const SQUIRCLE_PATH =
  "M1 0.5L0.99966 0.61439L0.99863 0.66165L0.99691 0.69776L0.99451 0.72799L0.99141 0.75437L0.98761 0.77795L0.98311 0.79932L0.97790 0.81888L0.97197 0.83689L0.96530 0.85355L0.95789 0.86900L0.94973 0.88334L0.94078 0.89665L0.93103 0.90900L0.92045 0.92045L0.90900 0.93103L0.89665 0.94078L0.88334 0.94973L0.86900 0.95789L0.85355 0.96530L0.83689 0.97197L0.81888 0.97790L0.79932 0.98311L0.77795 0.98761L0.75437 0.99141L0.72799 0.99451L0.69776 0.99691L0.66165 0.99863L0.61439 0.99966L0.5 1L0.38561 0.99966L0.33835 0.99863L0.30224 0.99691L0.27201 0.99451L0.24563 0.99141L0.22205 0.98761L0.20068 0.98311L0.18112 0.97790L0.16311 0.97197L0.14645 0.96530L0.13100 0.95789L0.11666 0.94973L0.10335 0.94078L0.09100 0.93103L0.07955 0.92045L0.06897 0.90900L0.05922 0.89665L0.05027 0.88334L0.04211 0.86900L0.03470 0.85355L0.02803 0.83689L0.02210 0.81888L0.01689 0.79932L0.01239 0.77795L0.00859 0.75437L0.00549 0.72799L0.00309 0.69776L0.00137 0.66165L0.00034 0.61439L0 0.5L0.00034 0.38561L0.00137 0.33835L0.00309 0.30224L0.00549 0.27201L0.00859 0.24563L0.01239 0.22205L0.01689 0.20068L0.02210 0.18112L0.02803 0.16311L0.03470 0.14645L0.04211 0.13100L0.05027 0.11666L0.05922 0.10335L0.06897 0.09100L0.07955 0.07955L0.09100 0.06897L0.10335 0.05922L0.11666 0.05027L0.13100 0.04211L0.14645 0.03470L0.16311 0.02803L0.18112 0.02210L0.20068 0.01689L0.22205 0.01239L0.24563 0.00859L0.27201 0.00549L0.30224 0.00309L0.33835 0.00137L0.38561 0.00034L0.5 0L0.61439 0.00034L0.66165 0.00137L0.69776 0.00309L0.72799 0.00549L0.75437 0.00859L0.77795 0.01239L0.79932 0.01689L0.81888 0.02210L0.83689 0.02803L0.85355 0.03470L0.86900 0.04211L0.88334 0.05027L0.89665 0.05922L0.90900 0.06897L0.92045 0.07955L0.93103 0.09100L0.94078 0.10335L0.94973 0.11666L0.95789 0.13100L0.96530 0.14645L0.97197 0.16311L0.97790 0.18112L0.98311 0.20068L0.98761 0.22205L0.99141 0.24563L0.99451 0.27201L0.99691 0.30224L0.99863 0.33835L0.99966 0.38561L1 0.5Z";

/** Скрытый SVG с определением сквиркл-обрезки для карточек. */
function SquircleDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute", pointerEvents: "none" }}>
      <defs>
        <clipPath id="squircle-clip" clipPathUnits="objectBoundingBox">
          <path d={SQUIRCLE_PATH} />
        </clipPath>
      </defs>
    </svg>
  );
}

/** Превращаем содержимое страницы меню в объект, пригодный для ArticleView. */
function pageAsPublication(key: MenuPageKey, content: PageContent): Publication {
  const meta = MENU_PAGES.find((p) => p.key === key)!;
  return {
    id: `page-${key}`,
    createdAt: 0,
    order: 0,
    title: meta.label,
    type: "article",
    color: "#000000",
    image: "",
    url: "",
    hashtags: [],
    enEnabled: true,
    blocks: content,
  };
}

export function SitePage() {
  const data = useSite();
  const ready = useSiteReady();
  const { id, page } = useParams();
  const navigate = useNavigate();
  const { locale, setLocale, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const article = id ? data.publications.find((p) => p.id === id) : undefined;
  const menuKey = page && MENU_KEYS.has(page) ? (page as MenuPageKey) : undefined;
  const menuContent = menuKey ? data.pages[menuKey] : undefined;
  const menuPub = menuKey && menuContent ? pageAsPublication(menuKey, menuContent) : undefined;
  const stageArticle = article ?? menuPub;
  const open = Boolean(stageArticle);

  // Любая смена маршрута (открытие страницы/статьи) сворачивает меню.
  useEffect(() => {
    setMenuOpen(false);
  }, [id, page]);

  if (!ready) {
    return <SiteLoader />;
  }

  return (
    <div className="page">
      <SquircleDefs />
      <div className={`site${menuOpen ? " menu-open" : ""}`}>
        {!open && <Banner data={data.banner} variant="hero" />}
        <Sidebar
          data={data}
          articleOpen={open}
          activeId={article?.id}
          onOpenArticle={(next) => navigate(`/p/${next}`)}
          onHome={() => navigate("/")}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((v) => !v)}
        />
        {open && stageArticle && (
          <Stage banner={data.banner} article={stageArticle} onClose={() => navigate("/")} />
        )}
        {open && stageArticle && (
          <div className="mobile-sheet">
            <Stage banner={data.banner} article={stageArticle} onClose={() => navigate("/")} />
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
      <MenuPanel open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
