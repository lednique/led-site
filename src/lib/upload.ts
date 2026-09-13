import { blobToDataUrl, dataUrlToBlob, fileExt, formatBytes, inspectImage, MB, prepareImageBlob, type UploadPolicy } from "./files";
import { supabase } from "./supabase";

const BUCKET = "media";

/** Картинка в статье: колонка читалки — 900 px, больше хранить смысла нет. */
export const ARTICLE_IMAGE_MAX_WIDTH = 900;

/**
 * Видео параллакс-блока. Файл уходит в Storage как есть (перекодировать видео
 * в браузере нельзя), поэтому единственное ограничение — вес. 50 МБ — лимит
 * бакета media в supabase/schema.sql.
 */
export const ARTICLE_VIDEO_MAX_BYTES = 50 * MB;

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
 * 2.112.3). Поэтому тип задаём файлу — иначе ролик, у которого браузер не
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

/* ——— видео ——— */

/**
 * Контейнер видео. Тип узнаём по первым байтам файла: расширению и file.type
 * доверять нельзя (Windows отдаёт пустой file.type, iPhone — video/x-m4v,
 * переименованный ролик — тип старого расширения), а Supabase сверяет
 * присланный MIME со списком корзины буквально.
 */
type VideoKind = {
  /** Расширение файла в Storage. */
  ext: string;
  /** MIME, который уйдёт в Storage. */
  mime: string;
  /** Такое видео браузер показывает в <video>. */
  playable: boolean;
  /** Название формата — для текста ошибки. */
  label: string;
  /** Запасной MIME той же семьи: для корзин, знающих только video/mp4. */
  retryAs?: string;
};

/** Тип по расширению: запасной путь, когда первые байты ничего не сказали. */
const VIDEO_BY_EXT: Record<string, VideoKind> = {
  mp4: { ext: "mp4", mime: "video/mp4", playable: true, label: "MP4" },
  m4v: { ext: "m4v", mime: "video/mp4", playable: true, label: "M4V" },
  mov: { ext: "mov", mime: "video/quicktime", playable: true, label: "MOV", retryAs: "video/mp4" },
  webm: { ext: "webm", mime: "video/webm", playable: true, label: "WebM" },
  ogv: { ext: "ogv", mime: "video/ogg", playable: true, label: "OGV" },
};

/** Как браузеры называют одни и те же контейнеры. */
const VIDEO_MIME_ALIAS: Record<string, string> = {
  "video/x-m4v": "video/mp4",
  "video/m4v": "video/mp4",
  "video/mp4v-es": "video/mp4",
  "video/x-mp4": "video/mp4",
  "video/mov": "video/quicktime",
  "video/x-quicktime": "video/quicktime",
};

/** Контейнеры, которых в браузере не существует: загружать их бессмысленно. */
const DEAD_VIDEO_MIME: Record<string, string> = {
  "video/x-matroska": "MKV",
  "video/x-msvideo": "AVI",
  "video/avi": "AVI",
  "video/x-ms-wmv": "WMV",
  "video/x-ms-asf": "WMV",
  "video/x-flv": "FLV",
  "video/mpeg": "MPEG",
};

/** Приводит MIME из браузера к записи, которую понимает Storage. */
function canonicalMime(raw: string): string {
  const mime = raw.split(";")[0].trim().toLowerCase();
  return VIDEO_MIME_ALIAS[mime] || mime;
}

function ascii(bytes: Uint8Array, from: number, len: number): string {
  let out = "";
  const end = Math.min(from + len, bytes.length);
  for (let i = from; i < end; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

/** Начало файла: сигнатуры контейнеров лежат в первых байтах, читать всё видео не нужно. */
async function headBytes(file: File, size = 4096): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.slice(0, Math.min(size, file.size)).arrayBuffer());
  } catch {
    return new Uint8Array();
  }
}

/** Определяет контейнер по сигнатуре. null — файл не похож ни на одно видео. */
async function sniffVideo(file: File): Promise<VideoKind | null> {
  const bytes = await headBytes(file);
  if (bytes.length < 12) return null;

  // ISO Base Media (MP4 / M4V / MOV): «ftyp» на четвёртом байте, дальше — марка.
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand.startsWith("qt")) return VIDEO_BY_EXT.mov;
    if (brand === "M4V ") return VIDEO_BY_EXT.m4v;
    // HEVC, AV1 и прочие марки — это всё тот же MP4-контейнер.
    return VIDEO_BY_EXT.mp4;
  }
  // EBML: WebM и MKV различаются строкой DocType рядом с заголовком.
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    const head = ascii(bytes, 0, bytes.length);
    if (head.includes("matroska") && !head.includes("webm")) {
      return { ext: "mkv", mime: "video/x-matroska", playable: false, label: "MKV" };
    }
    return VIDEO_BY_EXT.webm;
  }
  if (ascii(bytes, 0, 4) === "OggS") return VIDEO_BY_EXT.ogv;
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "AVI ") {
    return { ext: "avi", mime: "video/x-msvideo", playable: false, label: "AVI" };
  }
  if (ascii(bytes, 0, 3) === "FLV") return { ext: "flv", mime: "video/x-flv", playable: false, label: "FLV" };
  if (bytes[0] === 0x30 && bytes[1] === 0x26 && bytes[2] === 0xb2 && bytes[3] === 0x75) {
    return { ext: "wmv", mime: "video/x-ms-wmv", playable: false, label: "WMV" };
  }
  return null;
}

async function videoKind(file: File): Promise<VideoKind> {
  const sniffed = await sniffVideo(file);
  if (sniffed) return sniffed;
  const byExt = VIDEO_BY_EXT[fileExt(file.name)];
  if (byExt) return byExt;
  const mime = canonicalMime(file.type || "");
  const dead = DEAD_VIDEO_MIME[mime];
  if (dead) return { ext: "bin", mime, playable: false, label: dead };
  if (mime.startsWith("video/")) {
    const label = mime.slice("video/".length).replace(/^x-/, "");
    return { ext: label || "mp4", mime, playable: true, label: label.toUpperCase() };
  }
  return VIDEO_BY_EXT.mp4;
}

/** Видео нельзя пережать в браузере — слишком тяжёлый файл отклоняем с понятным текстом. */
export class OversizeVideoError extends Error {
  constructor(weight: number, maxBytes: number) {
    super(
      `Видео весит ${formatBytes(weight)} — это больше лимита ${formatBytes(maxBytes)}. ` +
        `Сожмите ролик перед загрузкой (например, до 1080p и меньшего битрейта).`,
    );
    this.name = "OversizeVideoError";
  }
}

/** Контейнер, который <video> не играет: блок на сайте остался бы пустым. */
export class UnplayableVideoError extends Error {
  constructor(label: string) {
    super(
      `Внутри файла — ${label}, браузеры такое видео не показывают. ` +
        `Пересохраните ролик в MP4 (H.264) или WebM и загрузите снова.`,
    );
    this.name = "UnplayableVideoError";
  }
}

/* ——— отказы Supabase Storage ——— */

/**
 * Настройки корзины media, которых ждёт сайт: публичная, файлы до 50 МБ,
 * принимает любые картинки и видео. Те же строки есть в supabase/schema.sql;
 * здесь они отдельным запросом — его можно вставить в SQL Editor и починить
 * загрузку, не запуская весь файл.
 */
export const MEDIA_BUCKET_FIX_SQL = `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['image/*', 'video/*'])
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
  /**
   * Причина отказа. По ней панель решает, есть ли обходной путь: `mime` и
   * `size` означают, что корзина не принимает именно видеофайлы, — тогда
   * ролик можно нарезать на кадры и загрузить картинками.
   */
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
  // 413: лимит веса корзины ниже, чем ARTICLE_VIDEO_MAX_BYTES.
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

/** Собирает понятный ответ панели на любую ошибку загрузки видео. */
export function videoUploadProblem(err: unknown): StorageProblem {
  if (err instanceof StorageRejectedError) return err.problem;
  if (err instanceof OversizeVideoError || err instanceof UnplayableVideoError) return { text: err.message, kind: "other" };
  const message = storageMessage(err);
  if (message) return { text: `Не удалось загрузить видео: ${message}`, kind: "other" };
  return { text: "Не удалось загрузить видео. Проверьте подключение и попробуйте ещё раз.", kind: "other" };
}

/**
 * Есть ли обходной путь для отказа Storage: когда корзина не принимает
 * видеофайлы (тип или вес), ролик всё равно можно показать — нарезав его
 * на кадры и загрузив картинками.
 */
export function canFallbackToFrames(problem: StorageProblem): boolean {
  return problem.kind === "mime" || problem.kind === "size";
}

/** Сколько кадров в последовательности грузим одновременно: сеть не забиваем, но и не по одному. */
const FRAME_UPLOAD_CONCURRENCY = 4;

/**
 * Загружает последовательность кадров как обычные картинки. Папка отдельная —
 * в корзине media кадры одного ролика лежат рядом и не путаются с видеофайлами.
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

/**
 * Загружает видео параллакс-блока в Storage без какой-либо обработки: кадры
 * и звуковую дорожку сайт не трогает. Без настроенного Storage вернётся
 * локальный blob:-адрес — его хватит, чтобы посмотреть блок в панели, но
 * после сохранения он работать не будет (о чём предупреждает подпись поля).
 *
 * Отказ базы не отдаётся сырым английским текстом: что случилось и как это
 * починить, говорит `describeStorageError`.
 */
export async function uploadVideo(file: File, folder = "video"): Promise<string> {
  if (file.size > ARTICLE_VIDEO_MAX_BYTES) {
    throw new OversizeVideoError(file.size, ARTICLE_VIDEO_MAX_BYTES);
  }
  const kind = await videoKind(file);
  if (!kind.playable) throw new UnplayableVideoError(kind.label);
  if (!supabase) return URL.createObjectURL(file);

  // MIME пробуем по очереди: точный тип файла, затем video/mp4 для того же
  // контейнера — корзины со старым перечнем типов знают только его.
  const attempts = [
    { mime: kind.mime, ext: kind.ext },
    ...(kind.retryAs ? [{ mime: kind.retryAs, ext: "mp4" }] : []),
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${attempt.ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, withMime(file, attempt.mime, file.name), {
      contentType: attempt.mime,
      upsert: true,
      cacheControl: "31536000",
    });
    if (!error) {
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      if (!url) throw new Error("Storage не вернул ссылку на файл");
      return url;
    }
    lastError = error;
    // Пробовать другой тип имеет смысл, только когда корзина отвергла именно его.
    if (!isMimeRejected(error)) break;
  }
  throw new StorageRejectedError(describeStorageError(lastError, kind.mime));
}

export function isRemoteSrc(src: string): boolean {
  return !src || src.startsWith("http") || src.startsWith("builtin:") || src.startsWith("/") || src.startsWith("blob:");
}

export async function ensureRemoteSrc(src: string, folder: string): Promise<string> {
  if (isRemoteSrc(src) || !src.startsWith("data:")) return src;
  const blob = dataUrlToBlob(src);
  return (await uploadBlob(blob, folder)) ?? src;
}
