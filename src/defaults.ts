import { svgAt, svgHeart, svgLinkedin, svgType } from "./navSvgs";
import type { Publication, SiteData } from "./types";

export const SITE_VERSION = 3;
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

export const defaultSite: SiteData = {
  version: SITE_VERSION,
  banner: {
    image: "builtin:banner",
    brand: L("FaceShop", "FaceShop"),
    title: L("3D FACE CHART\nCOLLECTION", "КОЛЛЕКЦИЯ\n3D FACE CHART"),
    cta: L("click to learn more", "нажмите, чтобы узнать больше"),
    url: "https://lednique.gumroad.com/",
  },
  nav: [
    { id: "nav-heart", label: L("Commissions", "Заказы"), url: "/p/commission", svg: svgHeart },
    { id: "nav-mail", label: L("Email", "Почта"), url: "mailto:hello@lednique.com", svg: svgAt },
    { id: "nav-type", label: L("About", "О студии"), url: "/p/about", svg: svgType },
    { id: "nav-in", label: L("LinkedIn", "LinkedIn"), url: "https://www.linkedin.com/", svg: svgLinkedin },
  ],
  socials: [
    { id: "s-ig", label: L("Instagram", "Instagram"), url: "https://www.instagram.com/lednique", image: "builtin:ig" },
    { id: "s-snap", label: L("Snapchat", "Snapchat"), url: "https://www.snapchat.com/add/lednique", image: "builtin:portrait" },
    { id: "s-gum", label: L("Gumroad", "Gumroad"), url: "https://lednique.gumroad.com/", image: "builtin:gumroad" },
  ],
  publications: [
    {
      id: "commission",
      createdAt: Date.UTC(2026, 7, 12, 18),
      order: 0,
      title: L("AI Photosession Commission Form", "Форма заказа AI-фотосессии"),
      type: "article",
      color: "#FF089C",
      image: "builtin:magenta",
      hashtags: ["commission"],
      enEnabled: true,
      blocks: {
        en: [
          { id: "c-h", type: "heading", text: "AI Photosession" },
          {
            id: "c-t",
            type: "text",
            markdown:
              "A directed stills session — **AI-assisted**, art-directed, finished like a campaign.\n\nDescribe the face, the light, and the feeling. I build the look from there.",
          },
          { id: "c-f", type: "form" },
        ],
        ru: [
          { id: "c-h-ru", type: "heading", text: "AI-фотосессия" },
          {
            id: "c-t-ru",
            type: "text",
            markdown:
              "Постановочная съёмка — **с помощью AI**, как кампания.\n\nОпишите лицо, свет и ощущение. Я соберу образ.",
          },
          { id: "c-f-ru", type: "form" },
        ],
      },
    },
    {
      id: "look-warm",
      createdAt: Date.UTC(2026, 7, 11, 16),
      order: 1,
      title: L("AI Photosession Commission Form", "Форма заказа AI-фотосессии"),
      type: "link",
      color: "#D86B09",
      image: "builtin:warm",
      url: "https://lednique.gumroad.com/",
      hashtags: ["look"],
      enEnabled: true,
      blocks: { en: [], ru: [] },
    },
    {
      id: "sunglasses",
      createdAt: Date.UTC(2026, 7, 10, 14),
      order: 2,
      title: L("Sunglasses 3D Model", "3D-модель очков"),
      type: "article",
      color: "#085AFF",
      image: "builtin:sunglasses",
      hashtags: ["3d"],
      enEnabled: true,
      blocks: {
        en: [
          { id: "sg-h", type: "heading", text: "Sunglasses" },
          {
            id: "sg-t",
            type: "text",
            markdown:
              "Hard-surface study. Acetate mass, metal pins, a lens that actually holds a reflection.\n\nBuilt for beauty films and product inserts — close enough to touch, light enough to wear in AR.",
          },
          { id: "sg-i", type: "image", src: "builtin:sunglasses", alt: "Sunglasses 3D" },
        ],
        ru: [
          { id: "sg-h-ru", type: "heading", text: "Очки" },
          {
            id: "sg-t-ru",
            type: "text",
            markdown:
              "Хард-серфейс. Ацетат, металл, линза с настоящим отражением.\n\nДля бьюти-роликов и AR — близко, чтобы коснуться.",
          },
          { id: "sg-i-ru", type: "image", src: "builtin:sunglasses", alt: "Очки 3D" },
        ],
      },
    },
    {
      id: "tracebase",
      createdAt: Date.UTC(2026, 7, 8, 12),
      order: 3,
      title: L("LED TraceBase", "LED TraceBase"),
      type: "article",
      color: "#75A2BD",
      image: "builtin:cyan",
      hashtags: ["studio"],
      enEnabled: true,
      blocks: {
        en: [
          { id: "tb-h", type: "heading", text: "LED TraceBase" },
          {
            id: "tb-t",
            type: "text",
            markdown:
              "A living library of face traces, mesh templates and makeup stacks used across Lens Studio work.\n\nNot a product page. A studio drawer — the marks I keep returning to.",
          },
        ],
        ru: [
          { id: "tb-h-ru", type: "heading", text: "LED TraceBase" },
          {
            id: "tb-t-ru",
            type: "text",
            markdown:
              "Живая библиотека трейсов лица, мешей и мейкап-стеков для Lens Studio.\n\nНе витрина. Ящик студии — то, к чему я возвращаюсь.",
          },
        ],
      },
    },
    {
      id: "look-link",
      createdAt: Date.UTC(2026, 7, 6, 10),
      order: 4,
      title: L("AI Photosession Commission Form", "Форма заказа AI-фотосессии"),
      type: "link",
      color: "#D86B09",
      image: "builtin:warm",
      url: "https://www.instagram.com/lednique",
      hashtags: [],
      enEnabled: true,
      blocks: { en: [], ru: [] },
    },
    {
      id: "about",
      createdAt: Date.UTC(2026, 6, 20, 9),
      order: 5,
      title: L("Studio note", "Заметка студии"),
      type: "article",
      color: "#75A2BD",
      image: "builtin:cyan",
      hashtags: ["note"],
      enEnabled: true,
      blocks: {
        en: [
          { id: "a-h", type: "heading", text: "Studio note" },
          {
            id: "a-t",
            type: "text",
            markdown:
              "LEDNIQUE is an **AR / XR** effect designer and digital makeup artist. Beauty first, then the rig.\n\nWork lives in Lens Studio, in stills, and in small objects that have to survive a close-up.",
          },
        ],
        ru: [
          { id: "a-h-ru", type: "heading", text: "Заметка студии" },
          {
            id: "a-t-ru",
            type: "text",
            markdown:
              "LEDNIQUE — дизайнер **AR / XR** эффектов и цифровой визажист. Сначала красота, потом риг.\n\nРабота живёт в Lens Studio, в кадрах и в мелких объектах, которые выдерживают крупный план.",
          },
        ],
      },
    },
  ],
};
