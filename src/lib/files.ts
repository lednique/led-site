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

/** Нужно ли отдать файл на сервер без пережатия. */
export async function keepsOriginal(file: File | Blob, filename = ""): Promise<boolean> {
  const kind = await inspectImage(file, filename);
  return kind.animated || kind.vector;
}

export async function compressImageBlob(
  file: File,
  max = 1600,
  quality = 0.84,
  mime = "image/jpeg",
): Promise<Blob> {
  if (!file.type.startsWith("image/") && !fileExt(file.name)) return file;
  // GIF, APNG, анимированный WebP, SVG, ICO — только оригинал, иначе теряется анимация.
  if (await keepsOriginal(file)) return file;
  if (!file.type.startsWith("image/")) return file;

  const raw = await readFileAsDataUrl(file);
  const img = new Image();
  img.src = raw;
  await new Promise((res, rej) => {
    img.onload = () => res(null);
    img.onerror = () => rej(new Error("image"));
  });

  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
  return blob ?? file;
}

export async function compressImage(file: File, max = 1600, quality = 0.84): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  if (!file.type.startsWith("image/") || (await keepsOriginal(file))) return raw;
  const blob = await compressImageBlob(file, max, quality);
  if (blob === file) return raw;
  return blobToDataUrl(blob);
}
