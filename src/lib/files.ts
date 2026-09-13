export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file);
  });
}

export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/javascript:/gi, "");
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const head = comma >= 0 ? dataUrl.slice(0, comma) : "";
  const body = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = head.match(/data:([^;]+)/)?.[1] || "image/jpeg";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/* ------------------------------------------------------------------ */
/* Анимированные и векторные форматы: GIF, APNG, анимированный WebP,   */
/* SVG, ICO. Такие файлы нельзя перерисовывать через canvas — останется */
/* один кадр, поэтому они уходят на сервер как есть.                    */
/* ------------------------------------------------------------------ */

export const ANIMATED_MIME = ["image/gif", "image/apng", "image/webp"];

export function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function asciiIndexOf(bytes: Uint8Array, token: string, from = 0): number {
  const needle = new Uint8Array(token.length);
  for (let i = 0; i < token.length; i += 1) needle[i] = token.charCodeAt(i);
  outer: for (let i = Math.max(0, from); i <= bytes.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((v, i) => bytes[i] === v);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** APNG = PNG, у которого есть чанк acTL до первого IDAT. */
export function isApngBytes(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, PNG_SIGNATURE)) return false;
  const actl = asciiIndexOf(bytes, "acTL");
  if (actl < 0) return false;
  const idat = asciiIndexOf(bytes, "IDAT");
  return idat < 0 || actl < idat;
}

export function isGifBytes(bytes: Uint8Array): boolean {
  return asciiIndexOf(bytes.subarray(0, 6), "GIF8") === 0;
}

export function isAnimatedWebpBytes(bytes: Uint8Array): boolean {
  if (asciiIndexOf(bytes.subarray(0, 4), "RIFF") !== 0) return false;
  if (asciiIndexOf(bytes.subarray(8, 12), "WEBP") !== 0) return false;
  return asciiIndexOf(bytes.subarray(0, 64), "ANIM") > 0 || asciiIndexOf(bytes.subarray(0, 64), "ANMF") > 0;
}

async function headBytes(file: Blob, size = 512 * 1024): Promise<Uint8Array> {
  const slice = file.slice(0, Math.min(size, file.size));
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

export type ImageKind = {
  /** GIF / APNG / анимированный WebP — сжимать нельзя. */
  animated: boolean;
  /** SVG, ICO — тоже уходят без обработки. */
  vector: boolean;
  /** Расширение файла на сервере. */
  ext: string;
  /** MIME для Storage. */
  mime: string;
};

export async function inspectImage(file: File | Blob, filename = ""): Promise<ImageKind> {
  const name = filename || (file instanceof File ? file.name : "");
  const ext = fileExt(name);
  const type = (file.type || "").toLowerCase();

  if (type.includes("svg") || ext === "svg") {
    return { animated: false, vector: true, ext: "svg", mime: "image/svg+xml" };
  }
  if (type.includes("icon") || ext === "ico") {
    return { animated: false, vector: true, ext: "ico", mime: type || "image/x-icon" };
  }

  let bytes: Uint8Array;
  try {
    bytes = await headBytes(file);
  } catch {
    bytes = new Uint8Array();
  }

  if (isGifBytes(bytes) || type === "image/gif" || ext === "gif") {
    return { animated: true, vector: false, ext: "gif", mime: "image/gif" };
  }
  if (isApngBytes(bytes) || type === "image/apng" || ext === "apng") {
    return { animated: true, vector: false, ext: "apng", mime: "image/apng" };
  }
  if (isAnimatedWebpBytes(bytes)) {
    return { animated: true, vector: false, ext: "webp", mime: "image/webp" };
  }
  if (type.includes("webp") || ext === "webp") {
    return { animated: false, vector: false, ext: "webp", mime: "image/webp" };
  }
  if (type.includes("png") || ext === "png") {
    return { animated: false, vector: false, ext: "png", mime: "image/png" };
  }
  return { animated: false, vector: false, ext: "jpg", mime: "image/jpeg" };
}

/* ------------------------------------------------------------------ */
/* Подготовка файла к загрузке                                          */
/*                                                                      */
/* Файл трогаем только тогда, когда он не влезает в лимиты поля:         */
/* подходящую по размеру картинку отдаём оригинальными байтами,          */
/* разрешение правим по maxWidth / maxSide, а вес — сначала качеством   */
/* и лишь потом разрешением.                                              */
/* ------------------------------------------------------------------ */

export const MB = 1024 * 1024;

export type UploadPolicy = {
  /** Ограничение по длинной стороне, px. */
  maxSide?: number;
  /** Ограничение по ширине, px. Приоритетнее maxSide — колонка статьи 900 px. */
  maxWidth?: number;
  /** Разрешение не трогаем вовсе (главный баннер): следим только за весом файла. */
  keepDimensions?: boolean;
  /** Лимит веса файла, байты. */
  maxBytes?: number;
  /** Качество lossy-кодирования, когда перерисовка всё-таки нужна. */
  quality?: number;
  /** Формат перерисованного файла. */
  mime?: string;
};

/** Форматы, которые браузер показывает сам — их можно отдать на сервер как есть. */
const WEB_SAFE_EXT = ["jpg", "jpeg", "png", "webp", "avif", "bmp", "gif", "apng", "svg", "ico"];

/** С какого качества начинать подбор веса: оно бережнее исходного 0.84. */
const MAX_QUALITY = 0.92;

export function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(bytes % MB === 0 ? 0 : 1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

/** Файл не влезает в лимит поля, а пережать его нельзя (GIF, APNG, SVG, ICO). */
export class OversizeImageError extends Error {
  constructor(weight: number, maxBytes: number, ext: string) {
    super(
      `Файл весит ${formatBytes(weight)} — это больше лимита ${formatBytes(maxBytes)}. ` +
        `${ext.toUpperCase()} сайт не пережимает: уменьшите картинку в редакторе и загрузите заново.`,
    );
    this.name = "OversizeImageError";
  }
}

function decodeImage(file: File): Promise<HTMLImageElement> {
  return readFileAsDataUrl(file).then(
    (raw) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("image"));
        img.src = raw;
      }),
  );
}

function naturalSize(img: HTMLImageElement): { w: number; h: number } {
  return { w: img.naturalWidth || img.width || 1, h: img.naturalHeight || img.height || 1 };
}

/** Рисует картинку в нужном размере и кодирует в Blob. null — если canvas недоступен. */
function renderImage(img: HTMLImageElement, w: number, h: number, mime: string, quality: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  if (mime === "image/jpeg") {
    // JPEG не умеет прозрачность — подложка сайта чёрная, как и фон статей.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), mime, quality));
}

/** Форматы-кандидаты: сначала запрошенный, затем WebP (держит прозрачность), затем JPEG. */
function formatLadder(preferred: string): string[] {
  const order = [preferred, "image/webp", "image/jpeg"];
  return order.filter((mime, i) => Boolean(mime) && order.indexOf(mime) === i);
}

/** Насколько ужать картинку, чтобы вписаться в maxWidth / maxSide. Больше 1 — не растягиваем. */
function scaleToFit(w: number, h: number, policy: UploadPolicy): number {
  if (policy.keepDimensions) return 1;
  let scale = 1;
  if (policy.maxWidth) scale = Math.min(scale, policy.maxWidth / w);
  if (policy.maxSide) scale = Math.min(scale, policy.maxSide / Math.max(w, h));
  return scale;
}

/** Ниже этого качества картинку уже портить некуда — дальше только разрешение. */
const MIN_QUALITY = 0.35;

/**
 * Подбирает качество под лимит веса: размер JPEG/WebP примерно пропорционален
 * качеству, поэтому сразу прыгаем к нужной ступени, а не идём по лесенке.
 * Форматы пробуем по очереди — первой строкой всегда запрошенный.
 */
async function encodeFormats(
  img: HTMLImageElement,
  w: number,
  h: number,
  maxBytes: number,
  formats: string[],
): Promise<{ blob: Blob | null; lightest: number }> {
  let lightest = Infinity;
  for (const mime of formats) {
    // PNG не принимает параметр качества: либо влезает, либо пробуем следующий формат.
    if (mime === "image/png") {
      const blob = await renderImage(img, w, h, mime, 1);
      if (blob && blob.size <= maxBytes) return { blob, lightest: blob.size };
      if (blob) lightest = Math.min(lightest, blob.size);
      continue;
    }
    let quality = MAX_QUALITY;
    for (let step = 0; step < 4 && quality >= MIN_QUALITY; step += 1) {
      const blob = await renderImage(img, w, h, mime, quality);
      if (!blob) return { blob: null, lightest };
      if (blob.size <= maxBytes) return { blob, lightest: blob.size };
      lightest = Math.min(lightest, blob.size);
      const next = Math.max(MIN_QUALITY, quality * (maxBytes / blob.size) * 0.95);
      // Дальше крутить бессмысленно: упёрлись в минимальное качество — идём на круг меньше.
      if (next >= quality) break;
      quality = next;
    }
  }
  return { blob: null, lightest };
}

/**
 * Ищет кодирование не тяжелее maxBytes: сначала качество и формат, разрешение
 * режем только в самом конце — и ровно настолько, чтобы в лимит влезть.
 * baseScale уже учитывает уменьшение под лимит ширины поля.
 */
async function encodeUnderLimit(
  img: HTMLImageElement,
  opts: { maxBytes: number; formats: string[]; baseScale: number },
): Promise<Blob | null> {
  const { w, h } = naturalSize(img);
  let scale = opts.baseScale;
  for (let round = 0; round < 4; round += 1) {
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const { blob, lightest } = await encodeFormats(img, tw, th, opts.maxBytes, opts.formats);
    if (blob) return blob;
    if (Math.max(tw, th) < 800) return null;
    // Не хватило: уменьшаем по площади (scale ~ sqrt от отношения весов).
    scale *= Math.min(0.85, Math.sqrt(opts.maxBytes / lightest) * 0.95);
  }
  return null;
}

/**
 * Готовит файл к загрузке в Storage. Возвращает исходный файл без изменений
 * (тогда `result === file`) — это сигнал, что пережатие не потребовалось.
 */
export async function prepareImageBlob(file: File, policy: UploadPolicy = {}): Promise<Blob> {
  const kind = await inspectImage(file, file.name);
  const maxBytes = policy.maxBytes ?? 0;
  const quality = policy.quality ?? 0.84;
  const mime = policy.mime ?? "image/jpeg";
  const webSafe = WEB_SAFE_EXT.includes(kind.ext);
  const overWeight = maxBytes > 0 && file.size > maxBytes;

  // Анимация и вектор через canvas потеряли бы кадры, поэтому уходят как есть.
  if (kind.animated || kind.vector) {
    if (overWeight) throw new OversizeImageError(file.size, maxBytes, kind.ext);
    return file;
  }

  // Поля без ограничения ширины (главный баннер): разрешение не трогаем никогда.
  if (policy.keepDimensions) {
    // Оригинальные байты в лимите — грузим их без единого повторного кодирования.
    if (!overWeight && webSafe) return file;
    const img = await decodeImage(file);
    if (overWeight) {
      const fitted = await encodeUnderLimit(img, { maxBytes, formats: formatLadder(mime), baseScale: 1 });
      // Не влезло даже на минимальном качестве — лучше отдать оригинал, чем испортить кадр.
      if (fitted) return fitted;
    }
    if (webSafe) return file;
    const { w, h } = naturalSize(img);
    return (await renderImage(img, w, h, mime, quality)) ?? file;
  }

  const img = await decodeImage(file);
  const { w, h } = naturalSize(img);
  const scale = scaleToFit(w, h, policy);
  // Уже подходит под лимит поля и вес — оригинал уходит без пережатия.
  if (scale >= 1 && !overWeight && webSafe) return file;

  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  let blob = scale < 1 ? await renderImage(img, tw, th, mime, quality) : null;
  if (overWeight) {
    blob = (await encodeUnderLimit(img, { maxBytes, formats: formatLadder(mime), baseScale: scale })) ?? blob;
  }
  // Формат, который браузер не покажет (HEIC и прочее), в любом случае кодируем заново.
  if (!blob && !webSafe) blob = await renderImage(img, tw, th, mime, quality);
  return blob ?? file;
}
