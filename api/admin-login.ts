import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Запасной вход в панель для сайтов БЕЗ Supabase (демо-режим, правки только
 * на своём устройстве). Если Supabase подключён, панель авторизуется через
 * Supabase Auth (`src/pages/Admin.tsx`) — тогда этот endpoint не используется.
 *
 * Переменная `ADMIN_PASSWORD` серверная (без префикса VITE_) и в браузер
 * не попадает.
 */

/** Простой in-memory лимит: не больше N попыток входа с одного IP за окно. */
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, number[]>();

function clientIp(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return (raw ?? "").split(",")[0].trim() || req.socket?.remoteAddress || "";
}

function tooManyAttempts(ip: string): boolean {
  if (!ip) return false;
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 500) {
    for (const [key, times] of attempts) {
      if (times.every((t) => now - t >= LOGIN_WINDOW_MS)) attempts.delete(key);
    }
  }
  return recent.length > LOGIN_MAX_ATTEMPTS;
}

/** Сравнение строк одинаковой длины без раннего выхода — чтобы не помогать подбору. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ ok: false, error: "ADMIN_PASSWORD is not set" });
    return;
  }

  if (tooManyAttempts(clientIp(req))) {
    res.status(429).json({ ok: false, error: "Too many attempts. Try again later." });
    return;
  }

  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!safeEqual(password, expected)) {
    res.status(401).json({ ok: false });
    return;
  }

  res.status(200).json({ ok: true });
}
