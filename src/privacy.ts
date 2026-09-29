import type { ArticleBlock, Publication } from "./types";
import { CONTACT_EMAIL, TELEGRAM_HANDLE, TELEGRAM_URL } from "./contacts";

/** Markdown-ссылки: в тексте показывается только подпись, адрес спрятан в ссылке. */
const EMAIL_LINK = `[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`;
const TELEGRAM_LINK = `[${TELEGRAM_HANDLE}](${TELEGRAM_URL})`;

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
  /** Страна. */
  cityRu: "Россия",
  cityEn: "Russia",
};

/**
 * Политика конфиденциальности. Встроена в сайт (не редактируется из панели)
 * и открывается как обычная статья по маршруту /privacy. Постоянная ссылка
 * на неё есть в подвале каждой страницы: ч. 2 ст. 18.1 152-ФЗ требует
 * обеспечить неограниченный доступ к документу.
 *
 * Текст намеренно сведён к обязательному минимуму: оператор, данные, цели
 * и основания, сроки, cookie/localStorage, третьи лица и трансграничность,
 * меры защиты, права субъекта и порядок обращений. Внутренняя кухня
 * (устройство сайта, версии, БД, админка) в политику не входит.
 * Обоснования — docs/legal-review-ru.md.
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
        `This Privacy Policy governs the processing of personal data on the LEDNIQUE website (the “Website”).\n\nOperator: ${OPERATOR.name}, ${OPERATOR.statusEn}, TIN ${OPERATOR.inn}, ${OPERATOR.cityEn}.\nContact: ${EMAIL_LINK} or Telegram ${TELEGRAM_LINK}.`,
      ),
      H("pp-h1", "1. Data processed"),
      T(
        "pp-t1",
        "- **Enquiries.** If you write to the Operator by email or Telegram: your email address or Telegram username, your name and any other details you include in your message.\n- **Technical data.** IP address, browser type and version, pages requested, referrer.\n- **Cookies and local storage** (see section 4).\n\nThe Website has no forms, registration or advertising and analytics services.",
      ),
      H("pp-h2", "2. Purposes and legal grounds"),
      T(
        "pp-t2",
        "- Enquiries are processed to reply to you and, if we agree to work together, to conclude and perform a contract (Article 6(1)(5) of Federal Law No. 152-FZ of 27 July 2006 “On Personal Data”).\n- Technical data is processed to operate and protect the Website and to determine the visitor’s region (Article 6(1)(7) of Federal Law No. 152-FZ).\n\nActions with data: collection, recording, storage, use, deletion. Data is not used for advertising and is not sold.",
      ),
      H("pp-h3", "3. Storage period"),
      T(
        "pp-t3",
        "Enquiries are stored for as long as needed to reply and to perform the contract, and afterwards for the period required by law; then they are deleted. Technical data is stored by the hosting provider for the period set by its rules.",
      ),
      H("pp-h4", "4. Cookies and local storage"),
      T(
        "pp-t4",
        "The Website stores the interface language and other display settings in your browser’s local storage. These values are not sent to the Operator. The Website sets no cookies of its own; third-party content embedded in the Website (videos, galleries) may set its own cookies. You can disable or delete cookies and local storage in your browser settings.",
      ),
      H("pp-h5", "5. Third parties and cross-border transfer"),
      T(
        "pp-t5",
        "The Operator does not transfer personal data to third parties except where required by law. The Website runs on the services of Vercel Inc., Supabase Inc. and Google LLC (USA); technical data is processed on their servers, including outside the Russian Federation. Emails are received in a mailbox located in the Russian Federation. Correspondence in Telegram is subject to that service’s terms.",
      ),
      H("pp-h6", "6. Data protection"),
      T(
        "pp-t6",
        "The Operator takes the legal, organisational and technical measures required by Article 19 of Federal Law No. 152-FZ to protect personal data from unlawful access, alteration and deletion. Connections to the Website are encrypted (HTTPS).",
      ),
      H("pp-h7", "7. Your rights and requests"),
      T(
        "pp-t7",
        `You have the right to obtain information about the processing of your data, to require its correction, blocking or deletion, and to withdraw your consent.\n\nSend your request to ${EMAIL_LINK}. The Operator replies within 10 working days.`,
      ),
      H("pp-h8", "8. Changes"),
      T(
        "pp-t8",
        "The current version of the Policy is always available on this page. Last updated: 29 September 2026.",
      ),
    ],
    ru: [
      T(
        "pp-intro",
        `Настоящая Политика конфиденциальности определяет порядок обработки персональных данных на сайте LEDNIQUE (далее — «Сайт»).\n\nОператор: ${OPERATOR.name}, ${OPERATOR.statusRu}, ИНН ${OPERATOR.inn}, ${OPERATOR.cityRu}.\nКонтакты: ${EMAIL_LINK} или Telegram ${TELEGRAM_LINK}.`,
      ),
      H("pp-h1", "1. Какие данные обрабатываются"),
      T(
        "pp-t1",
        "- **Обращения.** Если вы пишете Оператору по электронной почте или в Telegram: адрес электронной почты или имя пользователя в Telegram, ваше имя и иные сведения, которые вы указали в сообщении.\n- **Технические данные.** IP-адрес, тип и версия браузера, запрошенные страницы, источник перехода.\n- **Файлы cookie и локальное хранилище** (раздел 4).\n\nНа Сайте нет форм, регистрации, рекламных и аналитических сервисов.",
      ),
      H("pp-h2", "2. Цели и правовые основания"),
      T(
        "pp-t2",
        "- Обращения обрабатываются, чтобы ответить вам и, если мы договоримся о работе, заключить и исполнить договор (пункт 5 части 1 статьи 6 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных»).\n- Технические данные обрабатываются для работы и защиты Сайта, а также для определения региона посетителя (пункт 7 части 1 статьи 6 Федерального закона № 152-ФЗ).\n\nДействия с данными: сбор, запись, хранение, использование, удаление. Данные не используются для рекламы и не продаются.",
      ),
      H("pp-h3", "3. Сроки хранения"),
      T(
        "pp-t3",
        "Обращения хранятся, пока это нужно для ответа и исполнения договора, а затем в течение срока, который требует закон; после этого удаляются. Технические данные хранит хостинг-провайдер в сроки, установленные его правилами.",
      ),
      H("pp-h4", "4. Файлы cookie и локальное хранилище"),
      T(
        "pp-t4",
        "Сайт сохраняет в локальном хранилище вашего браузера язык интерфейса и другие настройки отображения. Эти значения Оператору не передаются. Собственных cookie Сайт не устанавливает; встроенные на Сайте материалы сторонних сервисов (видео, галереи) могут устанавливать свои cookie. Отключить или удалить cookie и локальное хранилище можно в настройках браузера.",
      ),
      H("pp-h5", "5. Третьи лица и трансграничная передача"),
      T(
        "pp-t5",
        "Оператор не передаёт персональные данные третьим лицам, кроме случаев, предусмотренных законом. Сайт работает на сервисах Vercel Inc., Supabase Inc. и Google LLC (США); технические данные обрабатываются на их серверах, в том числе за пределами Российской Федерации. Письма поступают на почтовый ящик, расположенный на территории Российской Федерации. Переписка в Telegram регулируется правилами этого сервиса.",
      ),
      H("pp-h6", "6. Защита данных"),
      T(
        "pp-t6",
        "Оператор принимает правовые, организационные и технические меры, предусмотренные статьёй 19 Федерального закона № 152-ФЗ, чтобы защитить персональные данные от неправомерного доступа, изменения и удаления. Соединение с Сайтом защищено шифрованием (HTTPS).",
      ),
      H("pp-h7", "7. Ваши права и обращения"),
      T(
        "pp-t7",
        `Вы вправе получить сведения об обработке своих данных, потребовать их уточнения, блокирования или удаления, а также отозвать согласие.\n\nНаправьте обращение на ${EMAIL_LINK}. Оператор ответит в течение 10 рабочих дней.`,
      ),
      H("pp-h8", "8. Изменения"),
      T(
        "pp-t8",
        "Актуальная версия Политики всегда доступна на этой странице. Дата последнего обновления: 29 сентября 2026 года.",
      ),
    ],
  },
};
