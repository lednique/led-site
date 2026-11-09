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

/** Полный адрес эндпоинта: apiUrl("/google-photos") → /api/google-photos. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
