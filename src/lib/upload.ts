import { blobToDataUrl, compressImageBlob, dataUrlToBlob } from "./files";
import { supabase } from "./supabase";

const BUCKET = "media";

function extOf(blob: Blob, fallback: string): string {
  if (blob.type.includes("svg")) return "svg";
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("webp")) return "webp";
  if (blob.type.includes("gif")) return "gif";
  if (blob.type.includes("icon")) return "ico";
  if (blob.type.includes("jpeg") || blob.type.includes("jpg")) return "jpg";
  return fallback;
}

async function uploadBlob(blob: Blob, folder: string): Promise<string | null> {
  if (!supabase) return null;
  const ext = extOf(blob, "jpg");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || "application/octet-stream",
    upsert: true,
  });
  if (error) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl || null;
}

export async function uploadMedia(
  file: File,
  folder = "images",
  opts?: { max?: number; mime?: string; quality?: number },
): Promise<string> {
  const keepRaw = file.type.includes("svg") || file.type.includes("icon") || file.name.endsWith(".ico");
  const blob = keepRaw ? file : await compressImageBlob(file, opts?.max ?? 1600, opts?.quality ?? 0.84, opts?.mime ?? "image/jpeg");
  const remote = await uploadBlob(blob, folder);
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
