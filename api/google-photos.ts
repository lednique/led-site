import type { VercelRequest, VercelResponse } from "@vercel/node";
import JSON5 from "json5";

type PublicPhoto = {
  id: string;
  src: string;
  width: number;
  height: number;
};

type CacheEntry = {
  expiresAt: number;
  photos: PublicPhoto[];
};

const CACHE_TTL = 5 * 60 * 1000;
const MAX_PHOTOS = 1000;
const MAX_HTML_SIZE = 8 * 1024 * 1024;
const GOOGLE_PHOTOS_HOSTS = new Set(["photos.app.goo.gl", "photos.google.com", "www.photos.google.com"]);
const albumCache = new Map<string, CacheEntry>();
const pendingAlbums = new Map<string, Promise<PublicPhoto[]>>();

/**
 * Публичный share-link безопасно читать с сервера: браузер не сталкивается с
 * CORS Google Photos, а в БД хранится только открытая ссылка на альбом.
 * Разрешаем ровно домены Google Photos, чтобы endpoint не стал SSRF-прокси.
 */
function parseSharedAlbumUrl(raw: string): URL | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || !GOOGLE_PHOTOS_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (url.username || url.password) return null;

    const path = url.pathname.toLowerCase();
    const isShortShareLink = url.hostname.toLowerCase() === "photos.app.goo.gl";
    const isLongShareLink = /(^|\/)share(\/|$)/.test(path);
    return isShortShareLink || isLongShareLink ? url : null;
  } catch {
    return null;
  }
}

function isGooglePhotosHost(url: URL): boolean {
  return GOOGLE_PHOTOS_HOSTS.has(url.hostname.toLowerCase());
}

function isGoogleImageHost(hostname: string): boolean {
  return /^lh\d+\.googleusercontent\.com$/i.test(hostname);
}

/** Убирает Google resize-параметры: размер будет добавлен клиентом под контейнер. */
function normalizeImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || raw.length > 4096) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !isGoogleImageHost(url.hostname)) return null;
    url.search = "";
    url.hash = "";
    const equalsAt = url.pathname.lastIndexOf("=");
    if (equalsAt > url.pathname.lastIndexOf("/")) url.pathname = url.pathname.slice(0, equalsAt);
    return url.toString();
  } catch {
    return null;
  }
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function toPhoto(id: unknown, src: unknown, width: unknown, height: unknown, fallbackId: string): PublicPhoto | null {
  const normalizedSrc = normalizeImageUrl(src);
  if (!normalizedSrc) return null;
  return {
    id: typeof id === "string" && id ? id : fallbackId,
    src: normalizedSrc,
    width: asNumber(width),
    height: asNumber(height),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Читает object literal из AF_initDataCallback без хрупкого regexp по всему
 * HTML: скобки внутри строк не сбивают границы JSON5-объекта.
 */
function readObjectLiteral(input: string, start: number): string | null {
  if (input[start] !== "{") return null;
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = start; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return input.slice(start, index + 1);
    }
  }

  return null;
}

/** Возвращает data из всех серверных AF_initDataCallback на странице альбома. */
function callbackData(html: string): unknown[] {
  const marker = "AF_initDataCallback(";
  const result: unknown[] = [];
  let offset = 0;

  while (offset < html.length) {
    const markerAt = html.indexOf(marker, offset);
    if (markerAt < 0) break;
    const objectAt = html.indexOf("{", markerAt + marker.length);
    if (objectAt < 0 || objectAt - markerAt > 64) {
      offset = markerAt + marker.length;
      continue;
    }
    const literal = readObjectLiteral(html, objectAt);
    offset = literal ? objectAt + literal.length : markerAt + marker.length;
    if (!literal) continue;

    try {
      const parsed = JSON5.parse(literal);
      if (isRecord(parsed) && "data" in parsed) result.push(parsed.data);
    } catch {
      // Google может прислать служебный callback в другом формате. Остальные
      // callbacks и fallback ниже всё равно дадут странице шанс загрузиться.
    }
  }

  return result;
}

/** Формат, который Google Photos использует для списка медиа в share-альбоме. */
function photosFromKnownAlbumShape(data: unknown): PublicPhoto[] {
  if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
  const photos: PublicPhoto[] = [];

  for (let index = 0; index < data[1].length && photos.length < MAX_PHOTOS; index += 1) {
    const row = data[1][index];
    if (!Array.isArray(row) || !Array.isArray(row[1])) continue;
    const detail = row[1];
    const photo = toPhoto(row[0], detail[0], detail[1], detail[2], `photo-${index}`);
    if (photo) photos.push(photo);
  }

  return photos;
}

/**
 * Fallback для небольших изменений внутренней разметки Google: находим в JSON5
 * массивы вида [url, width, height] независимо от глубины вложенности.
 */
function photosFromNestedImageDetails(data: unknown): PublicPhoto[] {
  const photos: PublicPhoto[] = [];
  const stack: unknown[] = [data];
  let visited = 0;

  while (stack.length && photos.length < MAX_PHOTOS && visited < 100_000) {
    const current = stack.pop();
    visited += 1;
    if (!Array.isArray(current)) continue;

    const photo = toPhoto(undefined, current[0], current[1], current[2], `photo-${photos.length}`);
    if (photo) photos.push(photo);

    for (let index = current.length - 1; index >= 0; index -= 1) {
      const child = current[index];
      if (Array.isArray(child)) stack.push(child);
    }
  }

  return photos;
}

/** Последний fallback — адреса картинок прямо в HTML (без метаданных размера). */
function photosFromHtmlUrls(html: string): PublicPhoto[] {
  const decoded = html
    .replaceAll("\\/", "/")
    .replaceAll("\\u003d", "=")
    .replaceAll("\\u0026", "&")
    .replaceAll("&amp;", "&");
  const matches = decoded.match(/https:\/\/lh\d+\.googleusercontent\.com\/[^\s"'<>\\\],]+/gi) ?? [];
  const photos: PublicPhoto[] = [];

  for (const match of matches) {
    if (photos.length >= MAX_PHOTOS) break;
    const photo = toPhoto(undefined, match, 0, 0, `photo-${photos.length}`);
    if (photo) photos.push(photo);
  }

  return photos;
}

function uniquePhotos(photos: PublicPhoto[]): PublicPhoto[] {
  const seen = new Set<string>();
  const result: PublicPhoto[] = [];
  for (const photo of photos) {
    if (seen.has(photo.src)) continue;
    seen.add(photo.src);
    result.push({ ...photo, id: photo.id || photo.src });
    if (result.length >= MAX_PHOTOS) break;
  }
  return result;
}

function extractPhotos(html: string): PublicPhoto[] {
  const callbackCandidates = callbackData(html);
  const known = callbackCandidates
    .map(photosFromKnownAlbumShape)
    .sort((left, right) => right.length - left.length)[0] ?? [];
  if (known.length) return uniquePhotos(known);

  const nested = callbackCandidates.flatMap(photosFromNestedImageDetails);
  if (nested.length) return uniquePhotos(nested);
  return uniquePhotos(photosFromHtmlUrls(html));
}

async function fetchSharedAlbumHtml(start: URL): Promise<string> {
  const controller = new AbortController();
  // Оставляем запас до стандартного лимита короткой Vercel Function.
  const timer = setTimeout(() => controller.abort(), 8_000);
  let current = start;

  try {
    for (let redirects = 0; redirects < 6; redirects += 1) {
      if (!isGooglePhotosHost(current)) throw new Error("The share link redirected outside Google Photos");
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          // Обычный браузерный UA нужен, чтобы Google отдал HTML share-страницы
          // с AF_initDataCallback, а не упрощённую страницу для робота.
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new Error("The share link has no redirect target");
        current = new URL(location, current);
        continue;
      }

      if (!response.ok) throw new Error(`Google Photos returned ${response.status}`);
      const size = Number(response.headers.get("content-length") || "0");
      if (size > MAX_HTML_SIZE) throw new Error("The album page is too large");
      const html = await response.text();
      if (html.length > MAX_HTML_SIZE) throw new Error("The album page is too large");
      return html;
    }
  } finally {
    clearTimeout(timer);
  }

  throw new Error("Too many redirects from Google Photos");
}

function pruneCache(now: number) {
  for (const [key, entry] of albumCache) {
    if (entry.expiresAt <= now) albumCache.delete(key);
  }
  // В тёплой serverless-функции не даём cache бесконечно расти от случайных URL.
  if (albumCache.size > 100) albumCache.clear();
}

async function listAlbumPhotos(albumUrl: URL): Promise<PublicPhoto[]> {
  const key = albumUrl.toString();
  const now = Date.now();
  pruneCache(now);
  const cached = albumCache.get(key);
  if (cached && cached.expiresAt > now) return cached.photos;

  const pending = pendingAlbums.get(key);
  if (pending) return pending;

  const task = fetchSharedAlbumHtml(albumUrl)
    .then(extractPhotos)
    .then((photos) => {
      if (!photos.length) throw new Error("No public photos were found in this album");
      albumCache.set(key, { photos, expiresAt: Date.now() + CACHE_TTL });
      return photos;
    })
    .finally(() => {
      pendingAlbums.delete(key);
    });

  pendingAlbums.set(key, task);
  return task;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawAlbum = Array.isArray(req.query.album) ? req.query.album[0] : req.query.album;
  const albumUrl = parseSharedAlbumUrl(typeof rawAlbum === "string" ? rawAlbum : "");
  if (!albumUrl) {
    res.status(400).json({ error: "Use a public Google Photos share link" });
    return;
  }

  try {
    const photos = await listAlbumPhotos(albumUrl);
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).json({ photos });
  } catch (error) {
    // Не отдаём пользователю внутренние детали Google/Vercel, но оставляем
    // причину в serverless-логах для диагностики публичной ссылки.
    console.error("Google Photos gallery failed", error);
    res.status(502).json({ error: "Google Photos album could not be loaded" });
  }
}
