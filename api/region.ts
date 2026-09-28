import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Определяет, какую версию сайта показывать посетителю: «ru» или «global».
 *
 * Vercel добавляет к запросу заголовок `x-vercel-ip-country` (данные
 * MaxMind по IP посетителя), поэтому сама страна не хранится и никуда
 * не передаётся — функция отвечает только кодом региона.
 *
 * Регион влияет только на блок «Соцсети»: в российской версии вместо иконок
 * (в том числе Instagram и Facebook — символики Meta Platforms Inc., чья
 * деятельность признана в РФ экстремистской и запрещена) показывается текстовый
 * ник Telegram. Заявки в обеих версиях идут через mailto и Telegram — сайт
 * персональные данные не собирает.
 *
 * Если страна не определилась (заголовка нет, сбой), отвечаем «ru»: российская
 * версия не показывает символику запрещённой организации, поэтому такой ответ
 * юридически осторожнее.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, OPTIONS");
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    res.status(405).json({ region: "ru", country: "" });
    return;
  }

  const raw = req.headers["x-vercel-ip-country"];
  const country = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().toUpperCase();
  const region = country && country !== "RU" ? "global" : "ru";

  res.status(200).json({ region, country });
}
