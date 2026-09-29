import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { pickLocale, useI18n } from "../i18n";
import { MarkdownView } from "../lib/markdown";
import { useArticleMedia } from "./ArticleMedia";
import { EmbedBlock } from "./EmbedBlock";
import { GooglePhotosGallery } from "./GooglePhotosGallery";
import { ParallaxVideo } from "./ParallaxVideo";
import { Reveal } from "./Reveal";
import { resolveSrc } from "../media";
import { CONTACT_EMAIL, TELEGRAM_HANDLE, TELEGRAM_URL, mailtoUrl } from "../contacts";
import type { ArticleBlock, Publication } from "../types";

type ArticleViewProps = {
  pub: Publication;
};

export function ArticleView({ pub }: ArticleViewProps) {
  const { locale, loc, t } = useI18n();
  const gate = useArticleMedia();
  const blocks = pickLocale(locale, pub.blocks, pub.enEnabled);
  const tag = pub.hashtags[0];
  // Пока статья под экраном загрузки, появление блоков не запускаем.
  const paused = Boolean(gate?.holding);

  function renderBlock(block: ArticleBlock): ReactNode {
    if (block.type === "heading") {
      return <h2 className="block-heading">{block.text}</h2>;
    }
    if (block.type === "text") {
      return <MarkdownView source={block.markdown} />;
    }
    if (block.type === "image") {
      return (
        <img
          className="block-image"
          src={resolveSrc(block.src)}
          alt={block.alt}
          loading="lazy"
          decoding="async"
        />
      );
    }
    if (block.type === "video") {
      // Параллакс-блок: кадр привязан к прокрутке статьи, плеера нет.
      // Источник — видеофайл или последовательность кадров (`frames`).
      return <ParallaxVideo id={block.id} src={block.src} frames={block.frames} />;
    }
    if (block.type === "googlePhotos") {
      return <GooglePhotosGallery albumUrl={block.albumUrl} />;
    }
    if (block.type === "link") {
      return <ArticleLink block={block} />;
    }
    if (block.type === "embed") {
      // Вставной HTML сторонних сервисов (iframe, виджеты, плееры…).
      // Контент авторский — добавляется только из панели управления.
      // EmbedBlock пишет код в DOM один раз и не трогает его при
      // перерисовках, поэтому виджет не перезапускается от скролла
      // статьи или фоновых обновлений данных.
      return <EmbedBlock code={block.code} />;
    }
    return <CommissionContact />;
  }

  return (
    <article className="article">
      <div className="article-top">
        <p className="stage-kicker">{tag ? `#${tag}` : t("Article", "Статья")}</p>
      </div>
      <h1 className="stage-title">{loc(pub.title)}</h1>
      <div className="article-blocks">
        {/* Каждый блок появляется при прокрутке: fade плюс сдвиг снизу вверх —
            та же анимация, что у карточек ленты. */}
        {blocks.map((block) => (
          <Reveal key={block.id} paused={paused}>
            {renderBlock(block)}
          </Reveal>
        ))}
      </div>
    </article>
  );
}

function ArticleLink({ block }: { block: Extract<ArticleBlock, { type: "link" }> }) {
  const { t } = useI18n();
  const url = (block.url || "").trim();
  const label = block.label?.trim() || t("Open", "Открыть");
  const className = `article-link article-link--${block.style ?? "solid"}`;
  const inner = (
    <>
      {label}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path
          d="M5 2.5h6.5V9M11.2 2.8 2.5 11.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );

  if (!url || url === "https://") return <span className={className}>{inner}</span>;

  const external = /^(https?:|mailto:|tel:)/i.test(url);
  if (external) {
    return (
      <a className={className} href={url} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }
  return (
    <Link className={className} to={url}>
      {inner}
    </Link>
  );
}

/**
 * Блок «Заказать работу» (в панели — блок типа «Заявки»).
 *
 * Формы на сайте нет ни в одной версии: кнопка открывает почтовую программу
 * посетителя (mailto) с готовой темой и заготовкой письма, рядом — ссылка
 * на Telegram. Переписка идёт в почтовом клиенте и мессенджере посетителя,
 * то есть вне сайта, поэтому сайт не собирает персональные данные и не
 * попадает под ч. 5 ст. 18 152-ФЗ (первичный сбор данных в базы за пределами
 * РФ). Подробный разбор — docs/legal-review-ru.md.
 */
function CommissionContact() {
  const { t } = useI18n();
  const subject = t("Commission request — LEDNIQUE", "Заявка на работу — LEDNIQUE");
  const body = t(
    "Hello!\n\nI’d like to discuss a project:\n— what is needed:\n— deadline:\n— budget:\n\n",
    "Здравствуйте!\n\nХочу обсудить проект:\n— что нужно сделать:\n— сроки:\n— бюджет:\n\n",
  );

  return (
    <div className="glass-form">
      <p className="form-note">
        {t("Tell me about your project — I’ll reply by email.", "Расскажите о проекте — отвечу письмом.")}
      </p>
      <a className="submit-btn tg-cta" href={mailtoUrl(subject, body)}>
        {CONTACT_EMAIL}
      </a>
      <p className="form-note form-note--muted">
        {t("or write in Telegram ", "или напишите в Telegram ")}
        <a className="inline-link" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
          {TELEGRAM_HANDLE}
        </a>
      </p>
    </div>
  );
}
