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
      <div className={`site${menuOpen ? " menu-open" : ""}`}>
        {!open && <Banner data={data.banner} variant="hero" />}
        <nav className="desktop-menu" aria-label={t("Menu", "Меню")}>
          {MENU_PAGES.map((p) => (
            <button
              key={p.key}
              type="button"
              className="menu-item"
              onClick={() => navigate(`/m/${p.key}`)}
            >
              <span className="menu-item-text">{locale === "ru" ? p.label.ru : p.label.en}</span>
            </button>
          ))}
        </nav>
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
      </div>
      {/* Подвал вне .site: градиент привязан к нижней границе страницы и не
          уезжает вместе с сайтом, когда открыто верхнее меню. */}
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
      <MenuPanel open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
