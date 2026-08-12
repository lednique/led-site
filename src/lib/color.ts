import type { CSSProperties } from "react";

export function cardSurface(color: string): CSSProperties {
  return {
    background: `linear-gradient(0deg, ${color} 0%, ${color} 100%), radial-gradient(ellipse 31.52% 50% at 50% 0%, #717171 0%, #111111 100%)`,
    backgroundBlendMode: "color, normal",
  };
}

export function isLightColor(hex: string): boolean {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 3 && raw.length !== 6) return false;
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 168;
}

export function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
