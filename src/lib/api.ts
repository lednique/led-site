/**
 * Адрес серверных функций сайта.
 *
 * На Vercel функции лежат в самом проекте — `api/*.ts`, поэтому по умолчанию
 * база это `/api`. На статическом хостинге (GitHub Pages) серверного кода нет,
 * и функции живут в Supabase Edge Functions — тогда база задаётся переменной
 * окружения на этапе сборки:
 *
 *   VITE_API_BASE=https://<project-ref>.supabase.co/functions/v1
 *
 * Хвостовой слэш убираем, чтобы не получить `//google-photos`.
 */
const ENV_BASE = (import.meta.env.VITE_API_BASE ?? "").trim();

export const API_BASE = (ENV_BASE || "/api").replace(/\/+$/, "");

/** Свой домен (Vercel) — ключ не нужен, запросы идут без него. */
const IS_REMOTE = /^https?:\/\//i.test(API_BASE);

/** Ключ проекта Supabase: тот же, что уходит в клиент для базы (публичный). */
const API_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

/** Полный адрес эндпоинта: apiUrl("/google-photos") → /api/google-photos. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * fetch к серверным функциям.
 *
 * Если функции живут в Supabase (внешний `VITE_API_BASE`), к запросу нужно
 * приложить ключ проекта в заголовке `apikey` — так работают новые ключи
 * Supabase (`sb_publishable_…`). Без него шлюз отвечает ещё до запуска кода
 * функции:
 *
 *   401 {"code":"MISSING_CREDENTIALS","message":"No credentials found on the request…"}
 *
 * На Vercel заголовок не добавляем: функции свои, ключ им не требуется.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (IS_REMOTE && API_KEY && !headers.has("apikey")) {
    headers.set("apikey", API_KEY);
  }
  return fetch(apiUrl(path), { ...init, headers });
}
