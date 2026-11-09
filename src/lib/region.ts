import { apiUrl } from "./api";

/** Регион посетителя: влияет только на то, какая версия блоков показывается. */
export type Region = "ru" | "global";

/** Ручной предпросмотр версий: ?region=ru | ?region=global | ?region=auto. */
const OVERRIDE_KEY = "lednique-region-override";
/** Ответ /api/region на время вкладки — чтобы не спрашивать на каждом маршруте. */
const SESSION_KEY = "lednique-region";
/**
 * Страна не определилась (функция не ответила, блокировщик, офлайн) →
 * считаем посетителя российским: в этой версии нет формы, собирающей
 * персональные данные, поэтому такой ответ безопаснее.
 */
const FALLBACK: Region = "ru";
const FETCH_TIMEOUT_MS = 2000;

function asRegion(value: unknown): Region | null {
  return value === "ru" || value === "global" ? value : null;
}

/**
 * Читает `?region=…` и запоминает выбор, чтобы предпросмотр версии
 * переживал переходы по сайту. `?region=auto` сбрасывает override
 * и возвращает определение по IP.
 */
function applyUrlOverride(): Region | null {
  try {
    const param = new URLSearchParams(window.location.search).get("region");
    if (!param) return null;
    if (param === "auto") {
      localStorage.removeItem(OVERRIDE_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    const value = asRegion(param);
    if (!value) return null;
    localStorage.setItem(OVERRIDE_KEY, value);
    return value;
  } catch {
    return null;
  }
}

function storedOverride(): Region | null {
  try {
    return asRegion(localStorage.getItem(OVERRIDE_KEY));
  } catch {
    return null;
  }
}

/**
 * Часовые пояса России. Нужны как фолбэк, когда серверного `/api/region`
 * нет (сайт на статическом хостинге — GitHub Pages): определяем регион
 * по часовому поясу браузера, без единого сетевого запроса и без передачи
 * IP посетителя третьим лицам.
 */
const RU_TIMEZONES = new Set<string>([
  "Europe/Moscow",
  "Europe/Kaliningrad",
  "Europe/Volgograd",
  "Europe/Kirov",
  "Europe/Astrakhan",
  "Europe/Saratov",
  "Europe/Ulyanovsk",
  "Europe/Samara",
  "Europe/Simferopol",
  "Asia/Yekaterinburg",
  "Asia/Omsk",
  "Asia/Novosibirsk",
  "Asia/Barnaul",
  "Asia/Tomsk",
  "Asia/Novokuznetsk",
  "Asia/Krasnoyarsk",
  "Asia/Irkutsk",
  "Asia/Chita",
  "Asia/Yakutsk",
  "Asia/Khandyga",
  "Asia/Vladivostok",
  "Asia/Ust-Nera",
  "Asia/Magadan",
  "Asia/Sakhalin",
  "Asia/Srednekolymsk",
  "Asia/Kamchatka",
  "Asia/Anadyr",
]);

/** Регион по часовому поясу. null — если определить не удалось. */
function regionFromTimeZone(): Region | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return null;
    return RU_TIMEZONES.has(tz) ? "ru" : "global";
  } catch {
    return null;
  }
}

function cachedRegion(): Region | null {
  try {
    return asRegion(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function remember(region: Region): void {
  try {
    sessionStorage.setItem(SESSION_KEY, region);
  } catch {
    /* приватный режим — просто не кэшируем */
  }
}

async function askServer(): Promise<Region | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(apiUrl("/region"), { cache: "no-store", signal: controller.signal });
    if (!resp.ok) return null;
    const body = (await resp.json().catch(() => null)) as { region?: unknown } | null;
    return asRegion(body?.region);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Итоговый регион: override → кэш вкладки → ответ сервера → пояс → «ru». */
export async function detectRegion(): Promise<Region> {
  const override = applyUrlOverride() ?? storedOverride();
  if (override) return override;

  const cached = cachedRegion();
  if (cached) return cached;

  const detected = await askServer();
  // Сервер ответил — на Vercel это точное определение по IP, верим ему.
  if (detected) {
    remember(detected);
    return detected;
  }
  // Сервера нет (статический хостинг): решаем по часовому поясу браузера,
  // а если и он не читается — «ru», версия без символики Meta.
  const region = regionFromTimeZone() ?? FALLBACK;
  remember(region);
  return region;
}
