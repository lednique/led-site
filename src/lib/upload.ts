import { blobToDataUrl, compressImageBlob, dataUrlToBlob, inspectImage } from "./files";
import { supabase } from "./supabase";

const BUCKET = "media";

async function uploadBlob(blob: Blob, folder: string, filename = ""): Promise<string | null> {
  if (!supabase) return null;
  const kind = await inspectImage(blob, filename);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${kind.ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: kind.mime || blob.type || "application/octet-stream",
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl || null;
}

export async function uploadMedia(
  file: File,
  folder = "images",
  opts?: { max?: number; mime?: string; quality?: number },
): Promise<string> {
  const kind = await inspectImage(file);
  // GIF, APNG, анимированный WebP, SVG и ICO загружаются как есть:
  // пережатие через canvas оставило бы от анимации один кадр.
  const blob = kind.animated || kind.vector
    ? file
    : await compressImageBlob(file, opts?.max ?? 1600, opts?.quality ?? 0.84, opts?.mime ?? "image/jpeg");
  const remote = await uploadBlob(blob, folder, file.name);
  if (remote) return remote;
  if (blob === file) return blobToDataUrl(file);
  return blobToDataUrl(blob);
}

export function isRemoteSrc(src: string): boolean {
  return !src || src.startsWith("http") || src.startsWith("builtin:") || src.startsWith("/") || src.startsWith("blob:");
}

export async function ensureRemoteSrc(src: string, folder: string): Promise<string> {
  if (isRemoteSrc(src) || !src.startsWith("data:")) return src;
  const blob = dataUrlToBlob(src);
  return (await uploadBlob(blob, folder)) ?? src;
}
