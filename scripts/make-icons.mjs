/**
 * Генерация иконок PWA из Apple Icon Composer (.icon) или обычной картинки.
 *
 *   npm i --no-save sharp
 *   node scripts/make-icons.mjs                       # из assets/led-pwa.icon
 *   node scripts/make-icons.mjs path/to/image.png     # из готовой картинки
 *
 * Создаёт в public/:
 *   icon-192.png / icon-512.png        — манифест (Android, splash-экран)
 *   icon-maskable-512.png              — maskable, логотип в safe-зоне 80%
 *   apple-touch-icon.png (180)         — iOS «На экран Домой»
 *   apple-touch-icon-167.png / -152.png — iPad Pro / iPad
 *
 * Про .icon: это бандл Xcode 26 (Icon Composer). Внутри icon.json с описанием
 * слоёв и заливки, а рядом Assets/ с SVG. Эффекты Apple (glass, refractivity,
 * translucency) — рантайм-фичи iOS, в PNG их не существует, поэтому мы
 * воспроизводим статическую основу: фоновый градиент + белый логотип.
 *
 * iOS не поддерживает альфа-канал в apple-touch-icon и сам скругляет углы,
 * поэтому иконки сводятся на непрозрачный фон.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "public");
const ICON_BUNDLE = resolve(root, "assets/led-pwa.icon");
/** Сетка Icon Composer: иконка проектируется на холсте 1024x1024. */
const APPLE_GRID = 1024;

/* ——— цвет ——— */

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (c) => Math.min(1, Math.max(0, c));

const P3_TO_XYZ = [
  [0.4865709, 0.2656677, 0.1982173],
  [0.2289746, 0.6917385, 0.0792869],
  [0.0, 0.0451134, 1.0439444],
];
const XYZ_TO_SRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252],
];
const mul = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

/** display-p3 → sRGB (у Apple цвета в широком охвате, у PNG — sRGB). */
function p3ToSrgb(r, g, b) {
  const xyz = mul(P3_TO_XYZ, [r, g, b].map(toLinear));
  return mul(XYZ_TO_SRGB, xyz).map((c) => Math.round(255 * clamp01(toGamma(c))));
}

/** Разбор строки цвета из icon.json: "display-p3:r,g,b,a" | "extended-gray:v,a". */
function parseAppleColor(spec) {
  const [space, nums] = spec.split(":");
  const v = nums.split(",").map(Number);
  if (space === "display-p3") return p3ToSrgb(v[0], v[1], v[2]);
  if (space === "extended-gray") {
    const c = Math.round(255 * clamp01(v[0]));
    return [c, c, c];
  }
  if (space === "srgb") return v.slice(0, 3).map((c) => Math.round(255 * clamp01(c)));
  throw new Error(`Неизвестное цветовое пространство: ${space}`);
}

const hex = ([r, g, b]) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

/* ——— чтение .icon ——— */

async function readIconBundle(dir) {
  const spec = JSON.parse(await readFile(resolve(dir, "icon.json"), "utf8"));
  const fills = spec["fill-specializations"] ?? [];
  // Берём светлую (базовую) заливку — она и есть внешний вид иконки.
  const base = fills.find((f) => !f.appearance) ?? fills[0];
  const stops = base?.value?.["linear-gradient"] ?? ["extended-gray:0,1"];
  const gradient = stops.map(parseAppleColor);

  const layer = spec.groups?.[0]?.layers?.[0];
  if (!layer) throw new Error("В icon.json нет слоёв");
  const art = resolve(dir, "Assets", layer["image-name"]);
  if (!existsSync(art)) throw new Error(`Нет файла слоя: ${art}`);

  // Масштаб слоя задан относительно сетки Icon Composer (1024x1024):
  // натуральный размер SVG × scale ⇒ доля холста, которую занимает логотип.
  const { width, height } = await sharp(art).metadata();
  const scale = layer.position?.scale ?? 1;
  const fraction = Math.max(width, height) * scale / APPLE_GRID;

  return { gradient, art, fraction };
}

/**
 * Холст с диагональным градиентом (Apple рисует его сверху вниз).
 * Строим маленький 2px-градиент и растягиваем — так делает и sharp-resize.
 */
async function gradientCanvas(size, colors) {
  const [from, to] = colors.length > 1 ? [colors[0], colors[colors.length - 1]] : [colors[0], colors[0]];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${hex(from)}"/>
      <stop offset="100%" stop-color="${hex(to)}"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#g)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Логотип, вписанный в долю холста (fraction), по центру. */
async function fitLogo(art, size, fraction) {
  const box = Math.round(size * fraction);
  return sharp(art, { density: 1200 })
    .resize(box, box, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/**
 * Фавиконка в SVG: тот же градиент и тот же знак, но векторно —
 * остаётся резкой на любом экране и во вкладке браузера.
 */
async function faviconSvg({ gradient, art, fraction }) {
  const body = await readFile(art, "utf8");
  const { width, height } = await sharp(art).metadata();
  const [from, to] = [gradient[0], gradient[gradient.length - 1]];
  // Вписываем исходный viewBox знака в квадрат 512 с заданной долей.
  const box = 512 * fraction;
  const k = Math.min(box / width, box / height);
  const x = (512 - width * k) / 2;
  const y = (512 - height * k) / 2;
  const inner = body
    .replace(/<\?xml[^>]*\?>\s*/i, "")
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${hex(from)}"/>
    <stop offset="100%" stop-color="${hex(to)}"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="114" fill="url(#bg)"/>
  <g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(4)})">${inner}</g>
</svg>
`,
  );
}

async function compose(size, { gradient, art }, { fraction, flatten }) {
  const bg = await gradientCanvas(size, gradient);
  const logo = await fitLogo(art, size, fraction);
  const meta = await sharp(logo).metadata();
  let img = sharp(bg).composite([
    {
      input: logo,
      top: Math.round((size - meta.height) / 2),
      left: Math.round((size - meta.width) / 2),
    },
  ]);
  if (flatten) img = img.flatten({ background: { r: 0, g: 0, b: 0 } });
  return img.png({ compressionLevel: 9 }).toBuffer();
}

/* ——— запуск ——— */

const arg = process.argv[2];
const source = arg ? resolve(arg) : ICON_BUNDLE;

let icon;
if (source.endsWith(".icon")) {
  icon = await readIconBundle(source);
  console.log(`Icon Composer: ${source}`);
  console.log(`  градиент: ${icon.gradient.map(hex).join(" → ")}`);
  console.log(`  логотип занимает ${(icon.fraction * 100).toFixed(1)}% холста`);
} else {
  // Обычная картинка: без фона, просто масштабируем.
  icon = { gradient: null, art: source, opacity: 1 };
  console.log(`Изображение: ${source}`);
}

await mkdir(out, { recursive: true });

// Масштаб логотипа берём из icon.json. У maskable safe-зона меньше (Android
// может обрезать иконку до круга), поэтому там знак дополнительно ужимаем.
const F = icon.fraction ?? 0.62;
const MASKABLE_F = F * 0.8;
const jobs = icon.gradient
  ? [
      ["icon-192.png", () => compose(192, icon, { fraction: F, flatten: false })],
      ["icon-512.png", () => compose(512, icon, { fraction: F, flatten: false })],
      ["icon-maskable-512.png", () => compose(512, icon, { fraction: MASKABLE_F, flatten: true })],
      ["apple-touch-icon.png", () => compose(180, icon, { fraction: F, flatten: true })],
      ["apple-touch-icon-152.png", () => compose(152, icon, { fraction: F, flatten: true })],
      ["apple-touch-icon-167.png", () => compose(167, icon, { fraction: F, flatten: true })],
      // Фавиконка вкладки: SVG + PNG-запасные варианты для старых браузеров.
      ["favicon.svg", () => faviconSvg(icon)],
      ["favicon-32.png", () => compose(32, icon, { fraction: F, flatten: false })],
      ["favicon-16.png", () => compose(16, icon, { fraction: F, flatten: false })],
    ]
  : [
      ["icon-192.png", () => sharp(icon.art).resize(192, 192, { fit: "contain" }).png().toBuffer()],
      ["icon-512.png", () => sharp(icon.art).resize(512, 512, { fit: "contain" }).png().toBuffer()],
    ];

for (const [name, make] of jobs) {
  const buf = await make();
  await writeFile(resolve(out, name), buf);
  console.log(`  ${name.padEnd(26)} ${(buf.length / 1024).toFixed(1)} kB`);
}

console.log("done");
