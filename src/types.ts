export type BlockType = "heading" | "text" | "image" | "googlePhotos" | "link" | "form" | "embed" | "video";

export type Locale = "en" | "ru";

export type Localized = { en: string; ru: string };

export type ArticleBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; markdown: string }
  | { id: string; type: "image"; src: string; alt: string }
  /** Общедоступный share-link альбома. Список фото загружается на сайте через /api/google-photos. */
  | { id: string; type: "googlePhotos"; albumUrl: string }
  | { id: string; type: "link"; label: string; url: string; style?: "solid" | "ghost" }
  | { id: string; type: "form" }
  | { id: string; type: "embed"; code: string }
  /**
   * Параллакс-видео: кадр привязан к прокрутке статьи, интерфейса плеера нет.
   *
   * `frames` — сам блок без видеофайла: последовательность кадров, которую
   * панель нарезает из ролика при загрузке (ролик как файл не хранится, в
   * Storage уезжают только картинки). `src` остаётся для ранее сохранённых
   * статей. Звук в таком блоке не нужен и не теряется.
   */
  | { id: string; type: "video"; src: string; frames?: string[] };

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

/** Фон экрана загрузки (Splash Screen): заливка цветом или изображение. */
export type SplashBackground = {
  type: "color" | "image";
  /** Цвет заливки, когда type === "color". */
  color: string;
  /** Изображение, когда type === "image". */
  image: string;
};

/** Ключи страниц верхнего меню (мобильная шапка). */
export type MenuPageKey = "about" | "commission" | "contacts";

/** Редактируемое содержимое страницы меню — те же блоки, что и в карточках, плюс подпись кнопки. */
export type PageContent = {
  en: ArticleBlock[];
  ru: ArticleBlock[];
  /** Название кнопки в шапке. Если нет — берём подпись из MENU_PAGES. */
  label?: Localized;
  /**
   * Шаблон письма (только у страницы «Заказать работу»): кнопка открывает
   * почтовую программу посетителя с этой темой и текстом.
   */
  mail?: MailTemplate;
};

/** Тема и текст письма на двух языках. */
export type MailTemplate = { subject: Localized; body: Localized };

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
  /** Фон экрана загрузки (Splash Screen). */
  splash: SplashBackground;
  /** Страницы верхнего меню: Обо мне, Заказать работу, Контакты. */
  pages: SitePages;
};
