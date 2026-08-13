import type { Publication, SiteData } from "./types";

export const SITE_VERSION = 4;
export const DEFAULT_ACCENT = "#5A5A5A";

function L(en: string, ru: string) {
  return { en, ru };
}

export function blankPublication(): Publication {
  return {
    id: crypto.randomUUID?.() ?? `pub-${Date.now()}`,
    createdAt: Date.now(),
    order: -1,
    title: L("New publication", "Новая публикация"),
    type: "article",
    color: DEFAULT_ACCENT,
    image: "",
    url: "",
    hashtags: [],
    enEnabled: true,
    blocks: {
      en: [{ id: `b-${Date.now()}`, type: "heading", text: "Heading" }],
      ru: [{ id: `b-ru-${Date.now()}`, type: "heading", text: "Заголовок" }],
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
