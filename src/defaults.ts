import { svgAt, svgHeart, svgLinkedin, svgType } from "./navSvgs";
import type { SiteData } from "./types";

export const SITE_VERSION = 2;

export const defaultSite: SiteData = {
  version: SITE_VERSION,
  banner: {
    image: "builtin:banner",
    brand: "FaceShop",
    title: "3D FACE CHART\nCOLLECTION",
    cta: "click to learn more",
    url: "https://lednique.gumroad.com/",
  },
  nav: [
    { id: "nav-heart", label: "Commissions", url: "/p/commission", svg: svgHeart },
    { id: "nav-mail", label: "Email", url: "mailto:hello@lednique.com", svg: svgAt },
    { id: "nav-type", label: "About", url: "/p/about", svg: svgType },
    { id: "nav-in", label: "LinkedIn", url: "https://www.linkedin.com/", svg: svgLinkedin },
  ],
  socials: [
    { id: "s-ig", label: "Instagram", url: "https://www.instagram.com/lednique", image: "builtin:ig" },
    { id: "s-snap", label: "Snapchat", url: "https://www.snapchat.com/add/lednique", image: "builtin:portrait" },
    { id: "s-gum", label: "Gumroad", url: "https://lednique.gumroad.com/", image: "builtin:gumroad" },
  ],
  publications: [
    {
      id: "commission",
      createdAt: Date.UTC(2026, 7, 12, 18),
      order: 0,
      title: "AI Photosession Commision Form",
      type: "article",
      color: "#FF089C",
      image: "builtin:magenta",
      blocks: [
        { id: "c-h", type: "heading", text: "AI Photosession" },
        {
          id: "c-t",
          type: "text",
          markdown:
            "A directed stills session — **AI-assisted**, art-directed, finished like a campaign.\n\nDescribe the face, the light, and the feeling. I build the look from there.",
        },
        { id: "c-f", type: "form" },
      ],
    },
    {
      id: "look-warm",
      createdAt: Date.UTC(2026, 7, 11, 16),
      order: 1,
      title: "AI Photosession Commision Form",
      type: "link",
      color: "#D86B09",
      image: "builtin:warm",
      url: "https://lednique.gumroad.com/",
      blocks: [],
    },
    {
      id: "sunglasses",
      createdAt: Date.UTC(2026, 7, 10, 14),
      order: 2,
      title: "Sunglasses 3D Model",
      type: "article",
      color: "#085AFF",
      image: "builtin:sunglasses",
      blocks: [
        { id: "sg-h", type: "heading", text: "Sunglasses" },
        {
          id: "sg-t",
          type: "text",
          markdown:
            "Hard-surface study. Acetate mass, metal pins, a lens that actually holds a reflection.\n\nBuilt for beauty films and product inserts — close enough to touch, light enough to wear in AR.",
        },
        { id: "sg-i", type: "image", src: "builtin:sunglasses", alt: "Sunglasses 3D" },
      ],
    },
    {
      id: "tracebase",
      createdAt: Date.UTC(2026, 7, 8, 12),
      order: 3,
      title: "LED TraceBase",
      type: "article",
      color: "#75A2BD",
      image: "builtin:cyan",
      blocks: [
        { id: "tb-h", type: "heading", text: "LED TraceBase" },
        {
          id: "tb-t",
          type: "text",
          markdown:
            "A living library of face traces, mesh templates and makeup stacks used across Lens Studio work.\n\nNot a product page. A studio drawer — the marks I keep returning to.",
        },
      ],
    },
    {
      id: "look-link",
      createdAt: Date.UTC(2026, 7, 6, 10),
      order: 4,
      title: "AI Photosession Commision Form",
      type: "link",
      color: "#D86B09",
      image: "builtin:warm",
      url: "https://www.instagram.com/lednique",
      blocks: [],
    },
    {
      id: "about",
      createdAt: Date.UTC(2026, 6, 20, 9),
      order: 5,
      title: "Studio note",
      type: "article",
      color: "#75A2BD",
      image: "builtin:cyan",
      blocks: [
        { id: "a-h", type: "heading", text: "Studio note" },
        {
          id: "a-t",
          type: "text",
          markdown:
            "LEDNIQUE is an **AR / XR** effect designer and digital makeup artist. Beauty first, then the rig.\n\nWork lives in Lens Studio, in stills, and in small objects that have to survive a close-up.",
        },
      ],
    },
  ],
};
