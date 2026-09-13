import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { pickLocale, useI18n } from "../i18n";
import { MarkdownView } from "../lib/markdown";
import { useArticleMedia } from "./ArticleMedia";
import { EmbedBlock } from "./EmbedBlock";
import { GooglePhotosGallery } from "./GooglePhotosGallery";
import { ParallaxVideo } from "./ParallaxVideo";
import { Reveal } from "./Reveal";
import { resolveSrc } from "../media";
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
    return <ContactForm />;
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

function ContactForm() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      message: String(data.get("message") ?? "").trim(),
      company: String(data.get("company") ?? ""),
      page: typeof window === "undefined" ? "" : window.location.href,
      locale,
    };

    if (!payload.name || !payload.email || !payload.message) return;

    setSending(true);
    setError("");
    try {
      const resp = await fetch("/api/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await resp.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!resp.ok || !result.success) {
        console.error("[contact-form] api error", resp.status, result.error);
        setError(
          resp.status === 429
            ? t("Too many attempts. Please try again later.", "Слишком много попыток. Попробуйте позже.")
            : resp.status === 503
              ? t(
                  "The message service is not configured yet. Please try again later.",
                  "Сервис отправки ещё не настроен. Попробуйте позже.",
                )
              : t(
                  "Could not send. Please try again later.",
                  "Не удалось отправить. Попробуйте позже.",
                ),
        );
        return;
      }
      form.reset();
      setSent(true);
    } catch (err) {
      console.error("[contact-form]", err);
      setError(
        t(
          "Could not send. Please try again later.",
          "Не удалось отправить. Попробуйте позже.",
        ),
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return <p className="form-thanks">{t("Received. I’ll write back.", "Получено. Я отвечу.")}</p>;
  }

  return (
    <form className="glass-form" onSubmit={handleSubmit} noValidate={false}>
      <label>
        {t("Name", "Имя")}
        <input name="name" required autoComplete="name" disabled={sending} />
      </label>
      <label>
        {t("Email", "Почта")}
        <input name="email" type="email" required autoComplete="email" disabled={sending} />
      </label>
      <label>
        {t("Message", "Сообщение")}
        <textarea name="message" rows={4} required disabled={sending} />
      </label>
      <p className="form-consent">
        {t(
          "By pressing “Send”, you agree to the ",
          "Нажимая кнопку «Отправить», вы соглашаетесь с ",
        )}
        <Link to="/privacy" state={{ from: location.pathname }}>
          {t("privacy policy", "политикой конфиденциальности")}
        </Link>
        .
      </p>
      {/* honeypot — невидимое поле, заполняют только спам-боты */}
      <input
        className="form-honeypot"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="submit-btn" type="submit" disabled={sending}>
        {sending ? t("Sending…", "Отправляем…") : t("Send", "Отправить")}
      </button>
    </form>
  );
}
