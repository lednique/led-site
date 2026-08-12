import imgWarm from "./assets/images/photosession-warm.jpg";
import imgMagenta from "./assets/images/photosession-magenta.jpg";
import imgCyan from "./assets/images/photosession-cyan.jpg";
import imgSunglasses from "./assets/images/sunglasses.jpg";
import imgHero from "./assets/images/hero.jpg";
import imgBanner from "./assets/images/banner-face.jpg";
import socialIg from "./assets/images/social-instagram.png";
import socialPortrait from "./assets/images/social-portrait.png";
import socialGumroad from "./assets/images/social-gumroad.png";

export const builtins: Record<string, string> = {
  "builtin:warm": imgWarm,
  "builtin:magenta": imgMagenta,
  "builtin:cyan": imgCyan,
  "builtin:sunglasses": imgSunglasses,
  "builtin:hero": imgHero,
  "builtin:banner": imgBanner,
  "builtin:ig": socialIg,
  "builtin:portrait": socialPortrait,
  "builtin:gumroad": socialGumroad,
};

export function resolveSrc(src: string): string {
  return builtins[src] ?? src;
}
