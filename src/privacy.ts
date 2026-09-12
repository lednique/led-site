import type { ArticleBlock, Publication } from "./types";

function H(id: string, text: string): ArticleBlock {
  return { id, type: "heading", text };
}

function T(id: string, markdown: string): ArticleBlock {
  return { id, type: "text", markdown };
}

/**
 * Политика конфиденциальности. Встроена в сайт (не редактируется из панели)
 * и открывается как обычная статья по маршруту /privacy — со стандартной
 * кнопкой закрытия.
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
        "This Privacy Policy (the “Policy”) describes how the LEDNIQUE website (the “Website”) collects, uses and stores personal data.\n\nBy using the Website and sending messages through the contact form, you agree to this Policy and to the processing of your data as described below.",
      ),
      H("pp-h1", "1. What data we collect"),
      T(
        "pp-t1",
        "Through the contact form you voluntarily provide us with the following data:\n\n- your name;\n- your email address;\n- your message text.\n\nWe do not request or process ID documents, payment details, or any special categories of personal data.",
      ),
      H("pp-h2", "2. How we use your data"),
      T(
        "pp-t2",
        "Contact-form data is used solely to get in touch with you and to respond to your message. We do not use your data for newsletters, advertising, or any other purpose without your separate consent.\n\nThe legal basis for processing is your consent, given by submitting the form.",
      ),
      H("pp-h3", "3. Sharing data with third parties"),
      T(
        "pp-t3",
        "We do not sell, share, or disclose your personal data to third parties for marketing or any other commercial purposes.\n\nForm messages may be delivered to the Website owner through the technical services required for the Website to operate (hosting, notification delivery). Data may be shared with third parties only where required by applicable law.",
      ),
      H("pp-h4", "4. Cookies and local storage"),
      T(
        "pp-t4",
        "The Website does not set its own cookies. Your interface language choice and the styling cache are stored locally in your browser (localStorage) and are never transmitted anywhere.\n\nEmbedded content from third-party services (videos, widgets, image galleries) may use their own cookies in accordance with those services’ privacy policies.",
      ),
      H("pp-h5", "5. Data retention and security"),
      T(
        "pp-t5",
        "Personal data is kept no longer than necessary to respond to your message, and is deleted afterwards. We take reasonable technical and organisational measures to protect data against unauthorised access, alteration, or destruction.",
      ),
      H("pp-h6", "6. Your rights"),
      T(
        "pp-t6",
        "You have the right to:\n\n- request access to your personal data;\n- request its correction or deletion;\n- withdraw your consent to data processing.\n\nTo do so, message us through the contact form on the Website — your request will be reviewed within the time frame set by law.",
      ),
      H("pp-h7", "7. Policy updates"),
      T(
        "pp-t7",
        "We may update this Policy from time to time. The current version is always available on this page.\n\nLast updated: September 2026.",
      ),
    ],
    ru: [
      T(
        "pp-intro",
        "Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок обработки персональных данных пользователей сайта LEDNIQUE (далее — «Сайт»).\n\nИспользуя Сайт и отправляя сообщения через форму связи, вы выражаете согласие с настоящей Политикой и обработкой ваших данных на описанных ниже условиях.",
      ),
      H("pp-h1", "1. Какие данные мы собираем"),
      T(
        "pp-t1",
        "Через форму связи вы добровольно предоставляете нам следующие данные:\n\n- имя;\n- адрес электронной почты;\n- текст сообщения.\n\nМы не запрашиваем и не обрабатываем паспортные данные, платёжную информацию, а также специальные категории персональных данных.",
      ),
      H("pp-h2", "2. Цели обработки данных"),
      T(
        "pp-t2",
        "Данные из формы связи используются исключительно для связи с вами и ответа на ваше обращение. Мы не используем ваши данные для рассылок, рекламы или иных целей без вашего отдельного согласия.\n\nПравовым основанием обработки является ваше согласие, выраженное отправкой формы (статья 9 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных»).",
      ),
      H("pp-h3", "3. Передача данных третьим лицам"),
      T(
        "pp-t3",
        "Мы не продаём, не передаём и не раскрываем ваши персональные данные третьим лицам в маркетинговых или иных коммерческих целях.\n\nСообщения из формы связи могут доставляться владельцу Сайта через технические сервисы, необходимые для работы Сайта (хостинг, доставка уведомлений). Передача данных третьим лицам возможна только в случаях, предусмотренных законодательством Российской Федерации.",
      ),
      H("pp-h4", "4. Cookies и локальное хранилище"),
      T(
        "pp-t4",
        "Сайт не устанавливает собственные cookies. Выбранный язык интерфейса и служебный кэш оформления хранятся локально в вашем браузере (localStorage) и никуда не передаются.\n\nВстроенные материалы сторонних сервисов (видео, виджеты, галереи изображений) могут использовать собственные cookies в соответствии с политиками конфиденциальности этих сервисов.",
      ),
      H("pp-h5", "5. Хранение и защита данных"),
      T(
        "pp-t5",
        "Персональные данные хранятся не дольше, чем это необходимо для ответа на ваше обращение, после чего удаляются. Мы принимаем разумные технические и организационные меры для защиты данных от неправомерного доступа, изменения или уничтожения.",
      ),
      H("pp-h6", "6. Ваши права"),
      T(
        "pp-t6",
        "Вы вправе:\n\n- запросить доступ к своим персональным данным;\n- потребовать их исправления или удаления;\n- отозвать согласие на обработку данных.\n\nДля этого напишите нам через форму связи на Сайте — обращение будет рассмотрено в сроки, установленные законодательством.",
      ),
      H("pp-h7", "7. Обновления Политики"),
      T(
        "pp-t7",
        "Мы можем обновлять настоящую Политику. Актуальная версия всегда доступна на этой странице.\n\nДата последнего обновления: сентябрь 2026 года.",
      ),
    ],
  },
};
