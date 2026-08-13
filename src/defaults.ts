import type {
  ArticleBlock,
  Localized,
  MenuPageKey,
  PageContent,
  Publication,
  SiteData,
  SitePages,
} from "./types";

export const SITE_VERSION = 4;
export const DEFAULT_ACCENT = "#5A5A5A";

function L(en: string, ru: string): Localized {
  return { en, ru };
}

function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Страницы верхнего меню и их двуязычные подписи (для шапки и редактора). */
export const MENU_PAGES: { key: MenuPageKey; label: Localized }[] = [
  { key: "about", label: L("About me", "Обо мне") },
  { key: "commission", label: L("Commission Request", "Заказать работу") },
  { key: "contacts", label: L("Contacts", "Контакты") },
];

/** Стартовое содержимое страницы меню — заголовок с именем страницы. */
function pageStarter(label: Localized): PageContent {
  const heading = (text: string): ArticleBlock => ({ id: uid("b"), type: "heading", text });
  return { en: [heading(label.en)], ru: [heading(label.ru)] };
}

function defaultPages(): SitePages {
  const entries = MENU_PAGES.map((p) => [p.key, pageStarter(p.label)] as const);
  return Object.fromEntries(entries) as SitePages;
}

export function blankPublication(): Publication {
  // EN и RU создаются синхронно: одинаковая структура блоков, одинаковые id
  // и одинаковый стартовый текст (русская версия берёт английский).
  const blockId = `b-${Date.now()}`;
  const blocks: Publication["blocks"]["en"] = [{ id: blockId, type: "heading", text: "Heading" }];
  return {
    id: crypto.randomUUID?.() ?? `pub-${Date.now()}`,
    createdAt: Date.now(),
    order: -1,
    title: L("New publication", "New publication"),
    type: "article",
    color: DEFAULT_ACCENT,
    image: "",
    url: "",
    hashtags: [],
    enEnabled: true,
    blocks: {
      en: blocks,
      ru: blocks.map((b) => ({ ...b })),
    },
  };
}

/**
 * Пустое состояние сайта без какого-либо демо-контента.
 * Используется как стартовая точка, пока не подтянутся данные из Supabase
 * (или из локального кэша). Пока сайт не подключён к базе, страница не должна
 * показывать «заглушки» — карточки, баннер, соцсети и подписи.
 */
export const defaultSite: SiteData = {
  version: SITE_VERSION,
  favicon: "",
  themeColor: "#000000",
  pages: defaultPages(),
  banner: {
    image: "",
    brand: L("", ""),
    title: L("", ""),
    cta: L("", ""),
    url: "",
  },
  nav: [],
  socials: [],
  publications: [],
};
