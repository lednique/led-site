import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Banner } from "../components/Banner";
import { SiteLoader } from "../components/Loader";
import { MenuPanel } from "../components/MenuPanel";
import { Sidebar } from "../components/Sidebar";
import { Stage } from "../components/Stage";
import { MENU_PAGES, pageLabel } from "../defaults";
import { useI18n } from "../i18n";
import { useSite, useSiteReady } from "../store";
import type { Localized, MenuPageKey, PageContent, Publication } from "../types";

const MENU_KEYS = new Set<string>(MENU_PAGES.map((p) => p.key));

/** Превращаем содержимое страницы меню в объект, пригодный для ArticleView. */
function pageAsPublication(key: MenuPageKey, content: PageContent, label: Localized): Publication {
  return {
    id: `page-${key}`,
    createdAt: 0,
    order: 0,
    title: label,
    type: "article",
    color: "#000000",
    image: "",
    url: "",
    hashtags: [],
    enEnabled: true,
    blocks: { en: content.en ?? [], ru: content.ru ?? [] },
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
  const menuPub =
    menuKey && menuContent ? pageAsPublication(menuKey, menuContent, pageLabel(data.pages, menuKey)) : undefined;
  const stageArticle = article ?? menuPub;
  const open = Boolean(stageArticle);

  // Любая смена маршрута (открытие страницы/статьи) сворачивает меню.
  useEffect(() => {
    setMenuOpen(false);
  }, [id, page]);

  // На мобильном основная лента должна оставаться на месте, пока поверх неё
  // открыт просмотр статьи. Сам .stage-reader при этом остаётся единственным
  // scroll-контейнером, поэтому длинные статьи продолжают прокручиваться.
  useEffect(() => {
    const media = window.matchMedia("(max-width: 799px)");
    const html = document.documentElement;
    const body = document.body;
    let locked = false;
    let savedScrollX = 0;
    let savedScrollY = 0;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
    };

    function lockPage() {
      if (locked) return;
      locked = true;
      savedScrollX = window.scrollX;
      savedScrollY = window.scrollY;
      html.classList.add("mobile-article-open");
      body.classList.add("mobile-article-open");
      html.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${savedScrollY}px`;
      body.style.left = `-${savedScrollX}px`;
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
    }

    function unlockPage() {
      if (!locked) return;
      html.classList.remove("mobile-article-open");
      body.classList.remove("mobile-article-open");
      html.style.overflow = previous.htmlOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;
      body.style.overflow = previous.bodyOverflow;
      window.scrollTo(savedScrollX, savedScrollY);
      locked = false;
    }

    function syncLock() {
      if (open && media.matches) lockPage();
      else unlockPage();
    }

    syncLock();
    media.addEventListener("change", syncLock);
    return () => {
      media.removeEventListener("change", syncLock);
      unlockPage();
    };
  }, [open]);

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
              <span className="menu-item-text">
                {locale === "ru" ? pageLabel(data.pages, p.key).ru : pageLabel(data.pages, p.key).en}
              </span>
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
