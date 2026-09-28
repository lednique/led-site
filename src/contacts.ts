/**
 * Публичные контакты сайта.
 *
 * Сайт не собирает персональные данные: вместо формы заявок — кнопка, которая
 * открывает почтовую программу посетителя (mailto), и ссылка на Telegram.
 * Переписка происходит в почтовом клиенте и мессенджере посетителя, то есть
 * вне сайта, поэтому ни ч. 5 ст. 18 152-ФЗ (первичный сбор данных в базы за
 * пределами РФ), ни согласие на обработку здесь не задействованы.
 *
 * ВАЖНО: замените CONTACT_EMAIL на реально работающий адрес — на него приходят
 * заявки. Подробности в docs/legal-review-ru.md.
 */
export const CONTACT_EMAIL = "hello@lednique.ru";

export const TELEGRAM_HANDLE = "@lednique";
export const TELEGRAM_URL = "https://t.me/lednique";

/** Ссылка mailto с готовой темой и (опционально) текстом письма. */
export function mailtoUrl(subject: string, body?: string): string {
  const params = new URLSearchParams({ subject });
  if (body) params.set("body", body);
  return `mailto:${CONTACT_EMAIL}?${params.toString()}`;
}
