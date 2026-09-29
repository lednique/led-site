import type { ArticleBlock, Publication } from "./types";
import { CONTACT_EMAIL, TELEGRAM_HANDLE, TELEGRAM_URL } from "./contacts";

function H(id: string, text: string): ArticleBlock {
  return { id, type: "heading", text };
}

function T(id: string, markdown: string): ArticleBlock {
  return { id, type: "text", markdown };
}

/**
 * Реквизиты оператора персональных данных.
 *
 * ЗАПОЛНИТЕ СВОИМИ ДАННЫМИ — без них политика формально неполная
 * (ч. 2 ст. 18.1 152-ФЗ требует сведений об операторе, а ст. 14 —
 * возможности связаться с ним). Подробности — docs/legal-review-ru.md
 * и docs/rkn-notifications.md.
 */
const OPERATOR = {
  /** Фамилия Имя Отчество (как в паспорте). */
  name: "Власов Виктор Викторович",
  /** Правовой статус: самозанятый (НПД), ИП, ООО… */
  statusRu: "самозанятый (плательщик налога на профессиональный доход)",
  statusEn: "self-employed (professional income tax payer)",
  /** ИНН — именно он однозначно идентифицирует оператора. */
  inn: "160101292015",
  /** Город/регион. */
  cityRu: "Россия",
  cityEn: "Russia",
};

/**
 * Политика конфиденциальности. Встроена в сайт (не редактируется из панели)
 * и открывается как обычная статья по маршруту /privacy — со стандартной
 * кнопкой закрытия. Постоянная ссылка на неё есть в подвале каждой страницы:
 * ч. 2 ст. 18.1 152-ФЗ требует обеспечить неограниченный доступ к документу.
 *
 * Форм на сайте нет ни в одной версии: заявки идут через почтовый клиент
 * посетителя (mailto) и через Telegram, то есть вне сайта. Поэтому политика
 * описывает только технические данные и переписку по инициативе посетителя.
 */
export const privacyPublication: Publication = {
  id: "page-privacy",
  createdAt: 0,
  order: 0,
  title: { en: "Privacy Policy", ru: "Политика конфиденциальности" },
  type: "article",
  color: "#000000",
  image: "",
  url: "",
  hashtags: [],
  enEnabled: true,
  blocks: {
    en: [
      T(
        "pp-intro",
        `This Privacy Policy (the “Policy”) describes what data the LEDNIQUE website (the “Website”) touches and how it is protected.\n\nOperator: ${OPERATOR.name}, ${OPERATOR.statusEn}, TIN ${OPERATOR.inn}, ${OPERATOR.cityEn}.\nContact: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) or Telegram ${TELEGRAM_HANDLE} (${TELEGRAM_URL}).`,
      ),
      H("pp-h1", "1. The Website does not collect your personal data"),
      T(
        "pp-t1",
        "The Website has no forms, no registration, no accounts, no newsletter subscription and no advertising or analytics scripts (counters, pixels). It is a portfolio: cards, articles, images.\n\nTo request work, press the email button — it opens **your own** mail app with a prepared message, or use the Telegram link. The correspondence then happens in your mail client or messenger, outside the Website, under the terms of those services.",
      ),
      H("pp-h2", "2. Two versions of the Website"),
      T(
        "pp-t2",
        "The Website determines the visitor’s country by IP address using the hosting provider’s geolocation data and shows one of two versions. The only difference is the “Social Networks” block: the international version shows social-network icons, the Russian version shows a text nickname linking to Telegram. The country is used solely to choose the version and is not stored by the Operator.",
      ),
      H("pp-h3", "3. Technical data"),
      T(
        "pp-t3",
        "Like any website, the Website’s infrastructure receives technical data with each request: IP address, browser type and version (user agent), requested pages, referrer. This data is processed by the hosting provider to deliver pages, keep the Website available and protect it from abuse. The Operator does not collect, store or analyse it, and there are no Operator-owned analytics.\n\nLegal basis: the Operator’s legitimate interests (Article 6(1)(6) of Federal Law No. 152-FZ of 27 July 2006 “On Personal Data”).",
      ),
      H("pp-h4", "4. Data stored in your browser"),
      T(
        "pp-t4",
        "The Website keeps three values in localStorage: the interface language, the splash-screen cache and the version preview flag (set only if you open the Website with `?region=`). They stay in your browser and are never transmitted to the Operator. The Website sets no cookies of its own; embedded third-party content (videos, widgets, galleries) may set its own cookies under those services’ policies.",
      ),
      H("pp-h5", "5. Third-party services"),
      T(
        "pp-t5",
        "- **Vercel Inc. (USA)** — hosting and server functions, IP geolocation, request logs.\n- **Supabase Inc.** — database of the Website’s content (cards, articles, settings). It stores no visitor personal data.\n- **Google LLC (USA)** — web fonts, Google Photos galleries, embedded videos.\n- Other services whose players or widgets may be embedded in articles.\n\nSince the Website itself does not collect personal data, the Operator transfers none. The technical data listed in section 3 reaches these providers as part of ordinary web requests between your browser and them. The USA is not included in the list of foreign states providing adequate protection of personal data subjects’ rights (Roskomnadzor Order No. 128 of 05.08.2022).",
      ),
      H("pp-h6", "6. If you write to us"),
      T(
        "pp-t6",
        "When you send an email or a Telegram message, the Operator processes your address or nickname and the content of your message in order to reply, and — if we agree on cooperation — to conclude and perform a services contract (Article 6(1)(2) and 6(1)(5) of Federal Law No. 152-FZ). The messages are kept as long as needed for the reply and the project, then deleted; deletion is recorded by an internal act.",
      ),
      H("pp-h7", "7. Security"),
      T(
        "pp-t7",
        "Measures required by Article 19 of Federal Law No. 152-FZ and Russian Government Decree No. 1119 are applied: access to the content database and the admin panel requires authentication (Supabase Auth), connections are encrypted (HTTPS), security headers are set, and the volume of processed data is minimised — there is simply no visitor database to protect.",
      ),
      H("pp-h8", "8. Your rights"),
      T(
        "pp-t8",
        `You may request information about the data the Operator holds about you, ask for its correction or deletion, withdraw consent where it was given, and complain to the supervisory authority (Roskomnadzor).\n\nWrite to [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) or to Telegram ${TELEGRAM_HANDLE}. Requests are reviewed within 10 working days (Article 20 of Federal Law No. 152-FZ).`,
      ),
      H("pp-h9", "9. Policy updates"),
      T(
        "pp-t9",
        "We may update this Policy. The current version is always available on this page.\n\nLast updated: 28 September 2026.",
      ),
    ],
    ru: [
      T(
        "pp-intro",
        `Настоящая Политика конфиденциальности (далее — «Политика») описывает, с какими данными работает сайт LEDNIQUE (далее — «Сайт») и как они защищаются.\n\nОператор: ${OPERATOR.name}, ${OPERATOR.statusRu}, ИНН ${OPERATOR.inn}, ${OPERATOR.cityRu}.\nСвязь с оператором: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) или Telegram ${TELEGRAM_HANDLE} (${TELEGRAM_URL}).`,
      ),
      H("pp-h1", "1. Сайт не собирает ваши персональные данные"),
      T(
        "pp-t1",
        "На Сайте нет форм, регистрации, личных кабинетов, подписки на рассылку, рекламных и аналитических скриптов (счётчиков, пикселей). Это портфолио: карточки, статьи, изображения.\n\nЧтобы заказать работу, нажмите кнопку с почтой — она откроет **вашу собственную** почтовую программу с подготовленным письмом, либо воспользуйтесь ссылкой на Telegram. Дальнейшая переписка происходит в вашем почтовом клиенте или мессенджере, вне Сайта, и регулируется правилами этих сервисов.",
      ),
      H("pp-h2", "2. Две версии Сайта"),
      T(
        "pp-t2",
        "Сайт определяет страну посетителя по IP-адресу (по данным геолокации хостинг-провайдера) и показывает одну из двух версий. Единственное отличие — блок «Соцсети»: в международной версии это иконки соцсетей, в российской — текстовый ник со ссылкой на Telegram. Страна используется только для выбора версии и Оператором не сохраняется.",
      ),
      H("pp-h3", "3. Технические данные"),
      T(
        "pp-t3",
        "Как и любой сайт, инфраструктура Сайта получает с каждым запросом технические данные: IP-адрес, тип и версию браузера (user agent), запрошенные страницы, источник перехода. Эти данные обрабатывает хостинг-провайдер, чтобы выдавать страницы, обеспечивать доступность Сайта и защищать его от злоупотреблений. Оператор их не собирает, не хранит и не анализирует; собственной аналитики на Сайте нет.\n\nПравовое основание: осуществление прав и законных интересов оператора (пункт 7 части 1 статьи 6 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных»).",
      ),
      H("pp-h4", "4. Данные в вашем браузере"),
      T(
        "pp-t4",
        "Сайт хранит в localStorage три значения: выбранный язык интерфейса, кэш экрана загрузки и флаг предпросмотра версии (появляется, только если вы открыли Сайт с параметром `?region=`). Они остаются в вашем браузере и Оператору не передаются. Собственных cookies Сайт не устанавливает; встроенные материалы сторонних сервисов (видео, виджеты, галереи) могут использовать свои cookies согласно их политикам.",
      ),
      H("pp-h5", "5. Сторонние сервисы"),
      T(
        "pp-t5",
        "- **Vercel Inc. (США)** — хостинг и серверные функции, геолокация по IP, журналы запросов.\n- **Supabase Inc.** — база данных содержимого Сайта (карточки, статьи, настройки). Персональные данные посетителей в ней не хранятся.\n- **Google LLC (США)** — веб-шрифты, галереи Google Photos, встроенные видео.\n- Иные сервисы, чьи плееры или виджеты могут быть встроены в статьи.\n\nПоскольку Сайт не собирает персональные данные, Оператор никому их не передаёт. Технические данные из раздела 3 попадают к перечисленным провайдерам в рамках обычных веб-запросов между вашим браузером и этими сервисами. США не входят в перечень иностранных государств, обеспечивающих адекватную защиту прав субъектов персональных данных (приказ Роскомнадзора от 05.08.2022 № 128).",
      ),
      H("pp-h6", "6. Если вы написали нам"),
      T(
        "pp-t6",
        "Когда вы отправляете письмо или сообщение в Telegram, Оператор обрабатывает ваш адрес или ник и содержание обращения, чтобы ответить, а при достижении договорённости — чтобы заключить и исполнить договор оказания услуг (пункт 5 части 1 статьи 6 Федерального закона № 152-ФЗ: исполнение договора, стороной которого является субъект, и заключение договора по его инициативе). Сообщения хранятся, пока нужны для ответа и работы над проектом, затем удаляются; факт удаления фиксируется внутренним актом.",
      ),
      H("pp-h7", "7. Меры защиты"),
      T(
        "pp-t7",
        "Применяются меры, предусмотренные статьёй 19 Федерального закона № 152-ФЗ и постановлением Правительства РФ № 1119: доступ к базе содержимого и к панели управления требует авторизации (Supabase Auth), соединения шифруются (HTTPS), заданы заголовки безопасности, объём обрабатываемых данных минимизирован — базы данных посетителей на Сайте просто нет.",
      ),
      H("pp-h8", "8. Ваши права"),
      T(
        "pp-t8",
        `Вы вправе запросить сведения о том, какие ваши данные есть у Оператора, потребовать их уточнения или удаления, отозвать ранее данное согласие, а также обратиться с жалобой в уполномоченный орган (Роскомнадзор).\n\nНапишите на [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) или в Telegram ${TELEGRAM_HANDLE}. Обращения рассматриваются в течение 10 рабочих дней (статья 20 Федерального закона № 152-ФЗ).`,
      ),
      H("pp-h9", "9. Обновления Политики"),
      T(
        "pp-t9",
        "Мы можем обновлять настоящую Политику. Актуальная версия всегда доступна на этой странице.\n\nДата последнего обновления: 28 сентября 2026 года.",
      ),
    ],
  },
};
