import type { Publication, SiteData } from "./types";

export const SITE_VERSION = 4;
export const DEFAULT_ACCENT = "#5A5A5A";

function L(en: string, ru: string) {
  return { en, ru };
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
