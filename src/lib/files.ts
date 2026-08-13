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

export async function compressImageBlob(
  file: File,
  max = 1600,
  quality = 0.84,
  mime = "image/jpeg",
): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type.includes("svg") || file.type.includes("icon")) {
    return file;
  }

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
  if (!file.type.startsWith("image/") || file.type.includes("svg")) return raw;
  const blob = await compressImageBlob(file, max, quality);
  if (blob === file) return raw;
  return blobToDataUrl(blob);
}
