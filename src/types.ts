export type BlockType = "heading" | "text" | "image" | "link" | "form";

export type Locale = "en" | "ru";

export type Localized = { en: string; ru: string };

export type ArticleBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; markdown: string }
  | { id: string; type: "image"; src: string; alt: string }
  | { id: string; type: "link"; label: string; url: string; style?: "solid" | "ghost" }
  | { id: string; type: "form" };

export type Publication = {
  id: string;
  createdAt: number;
  order: number;
  title: Localized;
  type: "link" | "article";
  color: string;
  image: string;
  url?: string;
  hashtags: string[];
  enEnabled: boolean;
  blocks: { en: ArticleBlock[]; ru: ArticleBlock[] };
};

export type NavItem = {
  id: string;
  svg: string;
  url: string;
  label: Localized;
};

export type SocialItem = {
  id: string;
  image: string;
  url: string;
  label: Localized;
};

export type BannerData = {
  image: string;
  brand: Localized;
  title: Localized;
  cta: Localized;
  url: string;
};

/** Ключи страниц верхнего меню (мобильная шапка). */
export type MenuPageKey = "about" | "commission" | "contacts";

/** Редактируемое содержимое страницы — те же блоки, что и в карточках. */
export type PageContent = { en: ArticleBlock[]; ru: ArticleBlock[] };

export type SitePages = Record<MenuPageKey, PageContent>;

export type SiteData = {
  version: number;
  publications: Publication[];
  nav: NavItem[];
  socials: SocialItem[];
  banner: BannerData;
  favicon: string;
  /** Цвет статус-бара / панели вкладок браузера (theme-color). */
  themeColor: string;
  /** Страницы верхнего меню: Обо мне, Заказать работу, Контакты. */
  pages: SitePages;
};
