/**
 * Генерация набора иконок PWA из одного исходника.
 *
 *   npm i --no-save sharp
 *   node scripts/make-icons.mjs <путь-к-исходнику.png>
 *
 * Создаёт в public/:
 *   icon-192.png            — Android / манифест
 *   icon-512.png            — Android / манифест, splash-экран
 *   icon-maskable-512.png   — maskable: логотип ужат в safe-зону (80%)
 *   apple-touch-icon.png    — 180x180, iOS «На экран Домой» (без прозрачности)
 *   apple-touch-icon-167.png / -152.png — iPad Pro / iPad
 *
 * iOS не поддерживает альфа-канал в иконках и сам скругляет углы, поэтому
 * apple-touch-icon сводится на непрозрачный фон (по умолчанию чёрный).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "public");

const src = process.argv[2];
if (!src) {
  console.error("Usage: node scripts/make-icons.mjs <source-image>");
  process.exit(1);
}

/** Цвет подложки для iOS-иконок (iOS не умеет прозрачность). */
const IOS_BG = process.argv[3] || "#000000";

function hexToRgb(hex) {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    alpha: 1,
  };
}

async function square(size, { background }) {
  return sharp(src)
    .resize(size, size, {
      fit: "contain",
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .flatten(background ? { background } : false)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Maskable: логотип занимает 80% холста, вокруг — фон-заливка. */
async function maskable(size, background) {
  const inner = Math.round(size * 0.8);
  const logo = await sharp(src)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const pad = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: logo, top: pad, left: pad }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

await mkdir(out, { recursive: true });

const bg = hexToRgb(IOS_BG);

const jobs = [
  ["icon-192.png", () => square(192, { background: null })],
  ["icon-512.png", () => square(512, { background: null })],
  ["icon-maskable-512.png", () => maskable(512, bg)],
  ["apple-touch-icon.png", () => square(180, { background: bg })],
  ["apple-touch-icon-152.png", () => square(152, { background: bg })],
  ["apple-touch-icon-167.png", () => square(167, { background: bg })],
];

for (const [name, make] of jobs) {
  const buf = await make();
  await writeFile(resolve(out, name), buf);
  console.log(`${name}  ${(buf.length / 1024).toFixed(1)} kB`);
}

console.log("done");
