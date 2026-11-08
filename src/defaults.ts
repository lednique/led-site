import { mailtoUrl } from "./contacts";
import type {
  ArticleBlock,
  Localized,
  MailTemplate,
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
  // Четвёртая кнопка — самая правая в строке меню. Подпись и содержимое
  // правятся в панели управления (вкладка «Меню»).
  { key: "portfolio", label: L("Portfolio", "Портфолио") },
];

/** Заводской шаблон письма для кнопки «Заказать работу». */
export const DEFAULT_MAIL: MailTemplate = {
  subject: L("Commission request — LEDNIQUE", "Заявка на работу — LEDNIQUE"),
  body: L(
    "Hello!\n\nI’d like to discuss a project:\n— what is needed:\n— deadline:\n— budget:\n\n",
    "Здравствуйте!\n\nХочу обсудить проект:\n— что нужно сделать:\n— сроки:\n— бюджет:\n\n",
  ),
};

/** Шаблон письма: из сохранённых страниц или заводской. */
export function pageMail(pages: SitePages | undefined): MailTemplate {
  const saved = pages?.commission?.mail;
  return {
    subject: { ...DEFAULT_MAIL.subject, ...saved?.subject },
    body: { ...DEFAULT_MAIL.body, ...saved?.body },
  };
}

/** Ссылка mailto для кнопки «Заказать работу» на нужном языке. */
export function commissionMailto(pages: SitePages | undefined, locale: "en" | "ru"): string {
  const mail = pageMail(pages);
  return mailtoUrl(mail.subject[locale], mail.body[locale]);
}

/** Стартовое содержимое страницы меню — заголовок с именем страницы. */
function pageStarter(label: Localized): PageContent {
  const heading = (text: string): ArticleBlock => ({ id: uid("b"), type: "heading", text });
  return { en: [heading(label.en)], ru: [heading(label.ru)], label: { ...label } };
}

export function defaultPages(): SitePages {
  const entries = MENU_PAGES.map((p) => [p.key, pageStarter(p.label)] as const);
  return Object.fromEntries(entries) as SitePages;
}

/** Подпись кнопки меню: из сохранённых страниц или заводская. */
export function pageLabel(pages: SitePages | undefined, key: MenuPageKey): Localized {
  const saved = pages?.[key]?.label;
  if (saved?.en || saved?.ru) return { en: saved.en || saved.ru, ru: saved.ru || saved.en };
  return MENU_PAGES.find((p) => p.key === key)!.label;
}

function isBlockList(value: unknown): value is ArticleBlock[] {
  return Array.isArray(value);
}

/**
 * Склеивает страницы меню с заводскими: пустой `{}` из базы не должен
 * затирать кнопки меню, иначе вкладка «Меню» в панели падает.
 */
export function mergePages(raw: unknown, fallback: SitePages = defaultPages()): SitePages {
  const src = raw && typeof raw === "object" ? (raw as Partial<Record<MenuPageKey, Partial<PageContent>>>) : {};
  const next = { ...fallback };
  for (const meta of MENU_PAGES) {
    const incoming = src[meta.key];
    const base = fallback[meta.key];
    next[meta.key] = {
      en: incoming && isBlockList(incoming.en) ? incoming.en : base.en,
      ru: incoming && isBlockList(incoming.ru) ? incoming.ru : base.ru,
      label: incoming?.label?.en || incoming?.label?.ru
        ? { en: incoming.label?.en || meta.label.en, ru: incoming.label?.ru || meta.label.ru }
        : (base.label ?? { ...meta.label }),
      ...(incoming?.mail || base.mail ? { mail: incoming?.mail ?? base.mail } : {}),
    };
  }
  return next;
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
  splash: { type: "color", color: "#000000", image: "" },
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
