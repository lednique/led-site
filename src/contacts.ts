/**
 * Публичные контакты сайта.
 *
 * Сайт не собирает персональные данные: вместо формы заявок — кнопка, которая
 * открывает почтовую программу посетителя (mailto), и ссылка на Telegram.
 * Переписка происходит в почтовом клиенте и мессенджере посетителя, то есть
 * вне сайта, поэтому ни ч. 5 ст. 18 152-ФЗ (первичный сбор данных в базы за
 * пределами РФ), ни согласие на обработку здесь не задействованы.
 *
 * Ящик намеренно российский (Яндекс Почта): ч. 5 ст. 18 152-ФЗ требует, чтобы
 * первичная запись данных граждан РФ попадала в базу на территории России, а
 * договорное основание (п. 5 ч. 1 ст. 6) в исключения из этого запрета не входит.
 * При зарубежном ящике (Gmail, Outlook, iCloud) первое же письмо российского
 * заказчика образует состав ч. 5 ст. 18 и требует уведомления по ст. 12.
 * Подробности — docs/legal-review-ru.md и docs/rkn-notifications.md, раздел 2.0.
 */
export const CONTACT_EMAIL = "lednique1@ya.ru";

export const TELEGRAM_HANDLE = "@lednique";
export const TELEGRAM_URL = "https://t.me/lednique";

/**
 * Ссылка mailto с готовой темой и (опционально) текстом письма.
 *
 * Кодируем через encodeURIComponent, а не URLSearchParams: тот заменяет
 * пробел на «+», а в mailto «+» — обычный плюс, и он попадает в письмо.
 * Переводы строк — CRLF, как требует RFC 6068.
 */
export function mailtoUrl(subject: string, body?: string): string {
  const enc = (v: string) => encodeURIComponent(v.replace(/\r?\n/g, "\r\n"));
  const parts = [`subject=${enc(subject)}`];
  if (body) parts.push(`body=${enc(body)}`);
  return `mailto:${CONTACT_EMAIL}?${parts.join("&")}`;
}
