export type BlockType = "heading" | "text" | "image" | "form";

export type ArticleBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; markdown: string }
  | { id: string; type: "image"; src: string; alt: string }
  | { id: string; type: "form" };

export type Publication = {
  id: string;
  createdAt: number;
  title: string;
  type: "link" | "article";
  color: string;
  image: string;
  url?: string;
  blocks: ArticleBlock[];
};

export type NavItem = {
  id: string;
  svg: string;
  url: string;
  label: string;
};

export type SocialItem = {
  id: string;
  image: string;
  url: string;
  label: string;
};

export type BannerData = {
  image: string;
  brand: string;
  title: string;
  cta: string;
  url: string;
};

export type SiteData = {
  version: number;
  publications: Publication[];
  nav: NavItem[];
  socials: SocialItem[];
  banner: BannerData;
};
