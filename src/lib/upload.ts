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

/**
 * Файл с нужным MIME.
 *
 * storage-js отправляет Blob частью multipart-формы, а тип берёт из самого
 * файла: опция `contentType` при этом не используется вовсе (проверено на
 * 2.112.3). Поэтому тип задаём файлу — иначе картинка, у которой браузер не
 * проставил file.type, уедет как application/octet-stream и корзина его
 * отвергнет, какой бы список MIME в ней ни был.
 */
function withMime(body: Blob, mime: string, name = ""): Blob {
  if (!mime || body.type === mime) return body;
  try {
    return name ? new File([body], name, { type: mime }) : new Blob([body], { type: mime });
  } catch {
    // Совсем старый браузер без File/Blob-конструктора: грузим что есть.
    return body;
  }
}

/** Кладёт картинку в Storage и возвращает ссылку вместе с причиной отказа. */
async function putImage(blob: Blob, folder: string, filename = ""): Promise<{ url: string | null; error: unknown }> {
  if (!supabase) return { url: null, error: null };
  const kind = await inspectImage(blob, filename);
  const mime = kind.mime || blob.type || "application/octet-stream";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${kind.ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, withMime(blob, mime, filename), {
    contentType: mime,
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) return { url: null, error };
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl || null, error: null };
}

/** То же, но отказ Storage не важен: картинки при неудаче уезжают в базу data:-ссылкой. */
async function uploadBlob(blob: Blob, folder: string, filename = ""): Promise<string | null> {
  return (await putImage(blob, folder, filename)).url;
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

/* ——— отказы Supabase Storage ——— */

/**
 * Настройки корзины media, которых ждёт сайт: публичная, файлы до 50 МБ,
 * принимает любые картинки. Те же строки есть в supabase/schema.sql; здесь
 * они отдельным запросом — его можно вставить в SQL Editor и починить
 * загрузку, не запуская весь файл.
 */
export const MEDIA_BUCKET_FIX_SQL = `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['image/*'])
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;`;

/** Ответ Storage на человеческом языке плюс то, чем его починить. */
export type StorageProblem = {
  /** Что случилось — уходит в alert и в подпись под полем загрузки. */
  text: string;
  /** Запрос для SQL Editor: показывается с кнопкой «Скопировать». */
  sql?: string;
  /** Причина отказа Storage. */
  kind: "mime" | "size" | "bucket" | "policy" | "other";
};

/**
 * Ошибка Storage из supabase-js: `status` — код HTTP, `statusCode` — код ошибки
 * из тела ответа («invalid_mime_type»), а в старых версиях библиотеки наоборот.
 * Смотрим на оба поля и на текст, чтобы не зависеть от версии клиента.
 */
type StorageErrorLike = { message?: string; status?: string | number; statusCode?: string | number };

function storageMessage(error: unknown): string {
  const err = error as StorageErrorLike | null;
  return String(err?.message || err || "").trim();
}

function storageStatuses(error: unknown): string[] {
  const err = error as StorageErrorLike | null;
  return [err?.status, err?.statusCode].map((value) => String(value ?? "")).filter(Boolean);
}

function matches(error: unknown, status: string, pattern: RegExp): boolean {
  return storageStatuses(error).includes(status) || pattern.test(storageMessage(error));
}

/** Корзина отвергла сам тип файла (HTTP 415) — имеет смысл попробовать другой. */
function isMimeRejected(error: unknown): boolean {
  return matches(error, "415", /mime type .* is not supported|invalid[_ ]mime[_ ]type/i);
}

/**
 * Разбирает отказ Storage. Почти всегда причина — корзина media в базе:
 * её настройки или политики остались от старой версии supabase/schema.sql,
 * поэтому к тексту прикладывается готовый запрос.
 */
export function describeStorageError(error: unknown, mime: string): StorageProblem {
  // 415: тип файла не входит в allowed_mime_types корзины.
  if (isMimeRejected(error)) {
    return {
      text:
        `Supabase не принимает файл с типом ${mime}: корзина media в базе разрешает не все типы. ` +
        `Это чинится одним запросом — скопируйте его в Supabase → SQL Editor и нажмите Run.`,
      sql: MEDIA_BUCKET_FIX_SQL,
      kind: "mime",
    };
  }
  // 413: файл тяжелее лимита корзины.
  if (matches(error, "413", /exceeded the maximum allowed size|too large/i)) {
    return {
      text:
        "Supabase ограничивает вес файла в корзине media сильнее, чем сайт. " +
        "Поднимите лимит до 50 МБ запросом под полем загрузки.",
      sql: MEDIA_BUCKET_FIX_SQL,
      kind: "size",
    };
  }
  // 404: корзины нет вовсе.
  if (matches(error, "404", /bucket not found/i)) {
    return {
      text:
        "В базе Supabase нет корзины media — сайт не знает, куда положить файл. " +
        "Создайте её запросом под полем загрузки.",
      sql: MEDIA_BUCKET_FIX_SQL,
      kind: "bucket",
    };
  }
  // 403: политики доступа до файлов не доехали.
  if (matches(error, "403", /row.level security|permission denied|not authorized/i)) {
    return {
      text:
        "Supabase запретил запись в корзину media. Запустите весь файл supabase/schema.sql " +
        "в SQL Editor — он создаёт и правила доступа к хранилищу.",
      kind: "policy",
    };
  }
  const message = storageMessage(error);
  return {
    text: message ? `Supabase отклонил загрузку: ${message}` : "Supabase отклонил загрузку файла.",
    kind: "other",
  };
}

/** Отказ Storage, дошедший до панели: текст и, если есть, способ починить базу. */
export class StorageRejectedError extends Error {
  readonly problem: StorageProblem;

  constructor(problem: StorageProblem) {
    super(problem.text);
    this.name = "StorageRejectedError";
    this.problem = problem;
  }
}

/** Сколько кадров в последовательности грузим одновременно: сеть не забиваем, но и не по одному. */
const FRAME_UPLOAD_CONCURRENCY = 4;

/**
 * Загружает последовательность кадров как обычные картинки. Папка отдельная —
 * в корзине media кадры одного ролика лежат рядом и не путаются с другими
 * картинками сайта.
 *
 * Без настроенного Storage возвращаются локальные blob:-адреса: блок можно
 * посмотреть в панели, но после сохранения он работать не будет.
 */
export async function uploadFrameSequence(
  blobs: Blob[],
  folder = "frames",
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  if (!supabase) return blobs.map((blob) => URL.createObjectURL(blob));

  const urls: string[] = new Array(blobs.length).fill("");
  let next = 0;
  let done = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= blobs.length) return;
      const { url, error } = await putImage(blobs[index], folder);
      if (!url) throw new StorageRejectedError(describeStorageError(error ?? new Error("Storage не вернул ссылку"), "кадр"));
      urls[index] = url;
      done += 1;
      onProgress?.(done, blobs.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(FRAME_UPLOAD_CONCURRENCY, blobs.length) }, worker));
  return urls;
}

export function isRemoteSrc(src: string): boolean {
  return !src || src.startsWith("http") || src.startsWith("builtin:") || src.startsWith("/") || src.startsWith("blob:");
}

export async function ensureRemoteSrc(src: string, folder: string): Promise<string> {
  if (isRemoteSrc(src) || !src.startsWith("data:")) return src;
  const blob = dataUrlToBlob(src);
  return (await uploadBlob(blob, folder)) ?? src;
}
