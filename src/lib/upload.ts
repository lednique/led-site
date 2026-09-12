import { blobToDataUrl, dataUrlToBlob, inspectImage, MB, prepareImageBlob, type UploadPolicy } from "./files";
import { supabase } from "./supabase";

const BUCKET = "media";

/** Картинка в статье: колонка читалки — 900 px, больше хранить смысла нет. */
export const ARTICLE_IMAGE_MAX_WIDTH = 900;

/** Главный баннер сайта: разрешение оригинала бережём, вес — до 2 МБ. */
export const BANNER_MAX_BYTES = 2 * MB;

/**
 * Политика по умолчанию для остальных полей панели: длинная сторона до 1600 px.
 * Баннер и картинки статей переопределяют её явно.
 */
const DEFAULT_POLICY: UploadPolicy = { maxSide: 1600, quality: 0.84, mime: "image/jpeg" };

/**
 * Если Storage не настроен, файл уезжает в базу как data:-ссылка. В таком виде
 * он попадает прямо в JSON настроек, поэтому тяжёлые оригиналы всё же дожимаем.
 */
const DATA_URL_MAX_BYTES = 1.2 * MB;

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

/**
 * Собирает политику поля: переданные значения имеют приоритет, пропущенные
 * берутся из DEFAULT_POLICY. keepDimensions отключает ограничение по размеру —
 * поля без него по-прежнему получают 1600 px по длинной стороне.
 */
function resolvePolicy(opts: UploadPolicy = {}): UploadPolicy {
  const keepDimensions = Boolean(opts.keepDimensions);
  return {
    keepDimensions,
    maxSide: keepDimensions ? undefined : (opts.maxSide ?? DEFAULT_POLICY.maxSide),
    maxWidth: opts.maxWidth,
    maxBytes: opts.maxBytes,
    quality: opts.quality ?? DEFAULT_POLICY.quality,
    mime: opts.mime ?? DEFAULT_POLICY.mime,
  };
}

export async function uploadMedia(file: File, folder = "images", opts?: UploadPolicy): Promise<string> {
  const policy = resolvePolicy(opts);
  // Файл проходит обработку только если он не влезает в лимиты поля:
  // разрешение правим по maxWidth/maxSide, вес — по maxBytes. Оригинальные
  // байты возвращаются как есть, когда ничего менять не нужно.
  const prepared = await prepareImageBlob(file, policy);
  const remote = await uploadBlob(prepared, folder, prepared === file ? file.name : "");
  if (remote) return remote;
  if (prepared.size <= DATA_URL_MAX_BYTES) return blobToDataUrl(prepared);
  try {
    return blobToDataUrl(await prepareImageBlob(file, { ...policy, maxBytes: DATA_URL_MAX_BYTES }));
  } catch {
    // GIF/SVG дожать нельзя — оставляем как есть, лучше тяжёлая ссылка, чем потерянный кадр.
    return blobToDataUrl(prepared);
  }
}

export function isRemoteSrc(src: string): boolean {
  return !src || src.startsWith("http") || src.startsWith("builtin:") || src.startsWith("/") || src.startsWith("blob:");
}

export async function ensureRemoteSrc(src: string, folder: string): Promise<string> {
  if (isRemoteSrc(src) || !src.startsWith("data:")) return src;
  const blob = dataUrlToBlob(src);
  return (await uploadBlob(blob, folder)) ?? src;
}
