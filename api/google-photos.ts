import type { VercelRequest, VercelResponse } from "@vercel/node";

type PublicPhoto = {
  id: string;
  src: string;
  width: number;
  height: number;
  /** Описание фотографии, заданное пользователем в Google Photos. Может отсутствовать. */
  description: string;
};

type CacheEntry = {
  expiresAt: number;
  photos: PublicPhoto[];
};

const CACHE_TTL = 5 * 60 * 1000;
const MAX_PHOTOS = 1000;
const MAX_HTML_SIZE = 8 * 1024 * 1000;
const GOOGLE_PHOTOS_HOSTS = new Set(["photos.app.goo.gl", "photos.google.com", "www.photos.google.com"]);
const BATCACHE_HOSTS = /^(photos|lh\d+)\.(googleusercontent|google)\.com$/i;
const albumCache = new Map<string, CacheEntry>();
const pendingAlbums = new Map<string, Promise<PublicPhoto[]>>();

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
};

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
  return GOOGLE_PHOTOS_HOSTS.has(url.hostname.toLowerCase()) || BATCACHE_HOSTS.test(url.hostname);
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

/**
 * Делает запрос с ручной обработкой редиректов (чтобы не дать fetch уйти с Google).
 * Возвращает финальный URL и текст ответа.
 */
async function googleFetch(url: URL, opts: { method?: string; body?: string; contentType?: string } = {}): Promise<{
  finalUrl: URL;
  text: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let current = new URL(url);

  try {
    for (let redirects = 0; redirects < 8; redirects += 1) {
      if (!isGooglePhotosHost(current)) throw new Error("The share link redirected outside Google Photos");
      const headers: Record<string, string> = { ...DEFAULT_HEADERS };
      if (opts.contentType) headers["Content-Type"] = opts.contentType;
      const response = await fetch(current.toString(), {
        method: opts.method ?? "GET",
        headers,
        body: opts.body,
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new Error("The share link has no redirect target");
        current = new URL(location, current);
        continue;
      }

      if (!response.ok) throw new Error(`Google Photos returned ${response.status}`);
      const text = await response.text();
      if (text.length > MAX_HTML_SIZE) throw new Error("The album page is too large");
      return { finalUrl: current, text };
    }
  } finally {
    clearTimeout(timer);
  }

  throw new Error("Too many redirects from Google Photos");
}

/**
 * Google Photos оборачивает JSON-ответы batchexecute в противоугонную
 * последовательность ")]}'\n" — убираем её перед JSON.parse.
 */
function stripAntiHijack(raw: string): string {
  return raw.replace(/^\)\]\}'\s*/, "");
}

async function batchexecute(
  rpcId: string,
  entries: Array<[unknown, ...unknown[]]>,
  at: URL,
): Promise<unknown[]> {
  const queryData = entries.map((payload) => [rpcId, JSON.stringify(payload), null, "generic"]);
  const body = new URLSearchParams();
  body.append("f.req", JSON.stringify([queryData]));

  const { text } = await googleFetch(new URL("/_/PhotosUi/data/batchexecute", at), {
    method: "POST",
    body: body.toString(),
    contentType: "application/x-www-form-urlencoded;charset=UTF-8",
  });

  try {
    return JSON.parse(stripAntiHijack(text)) as unknown[];
  } catch {
    return [];
  }
}

type AlbumMeta = {
  id: string;
  key: string;
  title: string;
  items: Array<{ id: string; url: string }>;
};

// RPC id из gphotos-scraper; snAcKc — листание альбома по страницам.
const LIST_RPC_ID = "snAcKc";
// fDcn4b — детальная информация об отдельном mediaItem (description, filename, size...).
const DETAIL_RPC_ID = "fDcn4b";

/**
 * Загружает share-страницу альбома, вытаскивает canonical-URL и параметр key,
 * затем через batchexecute подгружает список медиа и их описания.
 */
async function scrapeAlbum(startUrl: URL): Promise<AlbumMeta & { photoDetails: Map<string, { description: string; width: number; height: number }> }> {
  const { finalUrl: pageUrl, text: html } = await googleFetch(startUrl);

  // Из share-страницы нужно вытащить две вещи:
  // 1) <link rel="canonical" href="https://photos.google.com/share/...?key=...">
  // 2) на случай если canonical редиректит — album id из пути и key из query.
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const canonicalHref = canonicalMatch?.[1];
  let canonical: URL;
  try {
    canonical = canonicalHref ? new URL(canonicalHref, pageUrl) : pageUrl;
  } catch {
    canonical = pageUrl;
  }
  if (!isGooglePhotosHost(canonical)) canonical = pageUrl;

  let albumId = "";
  const pathParts = canonical.pathname.split("/").filter(Boolean);
  if (pathParts.length) albumId = pathParts[pathParts.length - 1];
  let key = canonical.searchParams.get("key") ?? "";
  if (!key) {
    // Резерв: если canonical не содержит key (иногда бывает у коротких ссылок),
    // пробуем вытащить его из исходного URL и из HTML.
    key = pageUrl.searchParams.get("key") ?? "";
    if (!key) {
      const keyMatch = html.match(/[?&]key=([^"&'<>\s]+)/);
      if (keyMatch) key = keyMatch[1];
    }
  }

  if (!albumId || !key) throw new Error("Could not locate album id or share key in the Google Photos page");

  // Шаг 1: пагинированно вытаскиваем id всех фотографий из альбома.
  const items: Array<{ id: string; url: string }> = [];
  let token: unknown = null;
  let pages = 0;
  let title = "";

  do {
    if (pages++ > 30) break; // не более ~15000 фото
    const resp = await batchexecute(LIST_RPC_ID, [[albumId, token, null, key]], canonical);
    const envelope = resp.find((item) => Array.isArray(item) && item[1] === LIST_RPC_ID) as unknown[] | undefined;
    if (!envelope) break;
    const innerText = typeof envelope[2] === "string" ? envelope[2] : "";
    if (!innerText) break;
    let parsed: unknown;
    try {
      parsed = JSON.parse(innerText);
    } catch {
      break;
    }
    // Формат: [albumIdRef, [[photoId, [url]], ...], nextToken, [albumId, title, dates, dl, cover, owner, ...], ...]
    const arr = parsed as unknown[];
    const pageItems = (arr?.[1] as unknown[] | undefined) ?? [];
    for (const row of pageItems) {
      if (!Array.isArray(row)) continue;
      const pid = typeof row[0] === "string" ? row[0] : "";
      const itemData = Array.isArray(row[1]) ? row[1] : null;
      const purl = typeof itemData?.[0] === "string" ? normalizeImageUrl(itemData[0]) : null;
      if (pid && purl) items.push({ id: pid, url: purl });
    }
    // Заголовок альбома лежит в [3][1].
    const meta = Array.isArray(arr?.[3]) ? (arr[3] as unknown[]) : [];
    if (!title && typeof meta[1] === "string" && meta[1]) title = meta[1];
    token = arr?.[2] ?? null;
  } while (token && items.length < MAX_PHOTOS);

  if (!items.length) throw new Error("No public photos were found in this album");

  // Шаг 2: пачками по 500 запрашиваем детальную информацию (description/size).
  const photoDetails = new Map<string, { description: string; width: number; height: number }>();
  const CHUNK = 400;
  const tasks: Array<Promise<void>> = [];

  for (let start = 0; start < items.length; start += CHUNK) {
    const chunk = items.slice(start, start + CHUNK);
    const payload = chunk.map((it) => [it.id, null, key] as const);
    tasks.push(
      batchexecute(DETAIL_RPC_ID, payload as unknown as Array<[unknown, ...unknown[]]>, canonical).then((resp) => {
        // Ответ на DETAIL_RPC_ID — плоский массив конвертов, по одному на каждый
        // запрошенный photo id. Каждый конверт: [некий id, rpcId, stringifiedJson].
        // Внутри stringifiedJson лежит [id, description, filename, createdAt, ?, size, width, height].
        // Порядок конвертов не гарантированно совпадает с порядком запроса, поэтому
        // сопоставляем по media id из разобранного JSON.
        for (const envelope of resp) {
          if (!Array.isArray(envelope) || envelope[1] !== DETAIL_RPC_ID) continue;
          const innerText = typeof envelope[2] === "string" ? envelope[2] : "";
          if (!innerText) continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(innerText);
          } catch {
            continue;
          }
          if (!Array.isArray(parsed)) continue;
          for (const entry of parsed) {
            if (!Array.isArray(entry)) continue;
            const pid = typeof entry[0] === "string" ? entry[0] : "";
            const match = chunk.find((c) => c.id === pid);
            if (!match) continue;
            const description = typeof entry[1] === "string" ? entry[1].trim() : "";
            const width = asNumber(entry[6]);
            const height = asNumber(entry[7]);
            photoDetails.set(pid, { description, width, height });
          }
        }
      }),
    );
  }

  await Promise.all(tasks);

  return { id: albumId, key, title, items, photoDetails };
}

function photosFromAlbumMeta(meta: Awaited<ReturnType<typeof scrapeAlbum>>): PublicPhoto[] {
  return meta.items.slice(0, MAX_PHOTOS).map((it, index) => {
    const d = meta.photoDetails.get(it.id);
    return {
      id: it.id || `photo-${index}`,
      src: it.url,
      width: d?.width ?? 0,
      height: d?.height ?? 0,
      description: d?.description ?? "",
    };
  });
}

function pruneCache(now: number) {
  for (const [key, entry] of albumCache) {
    if (entry.expiresAt <= now) albumCache.delete(key);
  }
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

  const task = scrapeAlbum(albumUrl)
    .then(photosFromAlbumMeta)
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

/**
 * Оставляем старый HTML-based fallback как последний шанс, если batchexecute
 * вдруг перестанет работать (например, Google поменяет RPC id). Он даст нам
 * список URL без описаний, что всё равно лучше сломанного виджета.
 */
async function fallbackFromHtml(albumUrl: URL): Promise<PublicPhoto[]> {
  const { text: html } = await googleFetch(albumUrl);
  const decoded = html
    .replaceAll("\\/", "/")
    .replaceAll("\\u003d", "=")
    .replaceAll("\\u0026", "&")
    .replaceAll("&amp;", "&");
  const matches = decoded.match(/https:\/\/lh\d+\.googleusercontent\.com\/[^\s"'<>\]\[,]+/gi) ?? [];
  const seen = new Set<string>();
  const photos: PublicPhoto[] = [];
  for (const match of matches) {
    const src = normalizeImageUrl(match);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    photos.push({ id: src, src, width: 0, height: 0, description: "" });
    if (photos.length >= MAX_PHOTOS) break;
  }
  return photos;
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
    let photos: PublicPhoto[];
    try {
      photos = await listAlbumPhotos(albumUrl);
    } catch (primaryError) {
      console.warn("Google Photos batchexecute failed, falling back to HTML scrape:", primaryError);
      photos = await fallbackFromHtml(albumUrl);
      if (!photos.length) throw primaryError;
    }
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).json({ photos });
  } catch (error) {
    console.error("Google Photos gallery failed", error);
    res.status(502).json({ error: "Google Photos album could not be loaded" });
  }
}
