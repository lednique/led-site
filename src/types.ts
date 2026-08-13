export type BlockType = "heading" | "text" | "image" | "form";

export type Locale = "en" | "ru";

export type Localized = { en: string; ru: string };

export type ArticleBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; markdown: string }
  | { id: string; type: "image"; src: string; alt: string }
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

export type SiteData = {
  version: number;
  publications: Publication[];
  nav: NavItem[];
  socials: SocialItem[];
  banner: BannerData;
  favicon: string;
};
