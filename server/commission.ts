/**
 * Общая логика приёма заявки с формы сайта и отправки её в Telegram.
 *
 * Этот файл находится вне `api/`: Vercel собирает его вместе с функцией,
 * вместо того чтобы пытаться зарегистрировать вспомогательный модуль как
 * отдельный endpoint. Vite подгружает тот же модуль в dev-режиме.
 *
 * Токен бота и chat_id берутся только из переменных окружения:
 *   TELEGRAM_BOT_TOKEN — токен от @BotFather
 *   TELEGRAM_CHAT_ID   — id чата администратора (см. `npm run telegram:chat-id`)
 */

export type CommissionInput = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  /** honeypot: скрытое поле, которое заполняют только боты */
  company?: unknown;
  /** страница, с которой отправлена заявка */
  page?: unknown;
  /** язык интерфейса на момент отправки */
  locale?: unknown;
};

export type CommissionResult = {
  status: number;
  body: {
    success: boolean;
    message?: string;
    error?: string;
  };
};

const MAX_NAME = 120;
const MAX_EMAIL = 200;
const MAX_MESSAGE = 4000;
const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
const TELEGRAM_TIMEOUT_MS = 10_000;

function asString(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, limit);
}

function envValue(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Ограничивает уже экранированный текст, не обрезая HTML-сущность вроде
 * `&amp;` посередине. Это оставляет сообщение в пределах лимита Telegram
 * даже если пользователь вставил очень длинный текст.
 */
function escapedMessage(value: string, maxLength: number): string {
  let result = "";
  let truncated = false;

  for (const character of value) {
    const part = escapeHtml(character);
    if (result.length + part.length + 1 > maxLength) {
      truncated = true;
      break;
    }
    result += part;
  }

  return truncated ? `${result}…` : result;
}

/** Простой in-memory лимит: не больше N заявок с одного IP за окно времени. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  if (!ip) return false;
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) hits.delete(key);
    }
  }
  return recent.length > RATE_LIMIT_MAX;
}

function formatMessage(data: {
  name: string;
  email: string;
  message: string;
  page: string;
  locale: string;
}): string {
  const when = new Date().toISOString().replace("T", " ").slice(0, 16);
  const prefix = [
    "✨ <b>Новая заявка с сайта</b>",
    "",
    `👤 <b>Имя:</b> ${escapeHtml(data.name)}`,
    `📧 <b>Email:</b> ${escapeHtml(data.email)}`,
    "💬 <b>Сообщение:</b>",
  ].join("\n");
  const suffixLines = ["", `🕐 ${when} UTC`];
  if (data.page) suffixLines.push(`🔗 ${escapeHtml(data.page)}`);
  if (data.locale) suffixLines.push(`🌐 ${escapeHtml(data.locale)}`);
  const suffix = suffixLines.join("\n");
  const available = Math.max(0, TELEGRAM_MAX_MESSAGE_LENGTH - prefix.length - suffix.length - 1);

  return `${prefix}\n${escapedMessage(data.message, available)}${suffix}`;
}

class CommissionConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommissionConfigurationError";
  }
}

async function sendToTelegram(text: string): Promise<void> {
  const token = envValue("TELEGRAM_BOT_TOKEN");
  const chatId = envValue("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    throw new CommissionConfigurationError("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    const raw = await resp.text().catch(() => "");

    let result: { ok?: unknown; description?: unknown } = {};
    try {
      result = JSON.parse(raw) as { ok?: unknown; description?: unknown };
    } catch {
      // The status below still gives us a useful error when Telegram returns
      // a non-JSON response (for example, from a temporary gateway failure).
    }

    if (!resp.ok || result.ok !== true) {
      const description = typeof result.description === "string" ? result.description : raw.slice(0, 300);
      throw new Error(`Telegram API ${resp.status}: ${description}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Telegram API timed out after ${TELEGRAM_TIMEOUT_MS} ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Обработка заявки. Возвращает статус и тело ответа. */
export async function handleCommission(
  input: CommissionInput,
  ip = "",
): Promise<CommissionResult> {
  // Honeypot: молча «принимаем» — бот думает, что всё хорошо.
  if (asString(input.company, 100)) {
    return { status: 200, body: { success: true, message: "Received." } };
  }

  if (rateLimited(ip)) {
    return {
      status: 429,
      body: { success: false, error: "Too many requests. Try again later." },
    };
  }

  const name = asString(input.name, MAX_NAME);
  const email = asString(input.email, MAX_EMAIL).toLowerCase();
  const message = asString(input.message, MAX_MESSAGE);
  const page = asString(input.page, 300);
  const locale = asString(input.locale, 10);

  if (!name || !email || !message) {
    return { status: 400, body: { success: false, error: "All fields are required." } };
  }
  if (!looksLikeEmail(email)) {
    return { status: 400, body: { success: false, error: "Invalid email address." } };
  }

  try {
    await sendToTelegram(formatMessage({ name, email, message, page, locale }));
  } catch (err) {
    console.error("[commission] telegram error:", err);
    return {
      status: err instanceof CommissionConfigurationError ? 503 : 502,
      body: {
        success: false,
        error: err instanceof CommissionConfigurationError
          ? "Message delivery is not configured."
          : "Could not deliver the message. Try again later.",
      },
    };
  }

  return { status: 200, body: { success: true, message: "Received." } };
}
