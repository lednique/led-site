import { useState, type FormEvent } from "react";
import { pickLocale, useI18n } from "../i18n";
import { MarkdownView } from "../lib/markdown";
import { resolveSrc } from "../media";
import type { Publication } from "../types";
import { CloseIcon } from "./Icons";
import { NavButton } from "./NavButton";

type ArticleViewProps = {
  pub: Publication;
  onClose: () => void;
};

export function ArticleView({ pub, onClose }: ArticleViewProps) {
  const { locale, loc, t } = useI18n();
  const blocks = pickLocale(locale, pub.blocks, pub.enEnabled);
  const tag = pub.hashtags[0];

  return (
    <article className="article">
      <div className="article-top">
        <p className="stage-kicker">{tag ? `#${tag}` : t("Article", "Статья")}</p>
        <NavButton label="Close" onClick={onClose}>
          <CloseIcon />
        </NavButton>
      </div>
      <h1 className="stage-title">{loc(pub.title)}</h1>
      <div className="article-blocks">
        {blocks.map((block) => {
          if (block.type === "heading") {
            return (
              <h2 key={block.id} className="block-heading">
                {block.text}
              </h2>
            );
          }
          if (block.type === "text") {
            return <MarkdownView key={block.id} source={block.markdown} />;
          }
          if (block.type === "image") {
            return <img key={block.id} className="block-image" src={resolveSrc(block.src)} alt={block.alt} />;
          }
          return <ContactForm key={block.id} />;
        })}
      </div>
    </article>
  );
}

function ContactForm() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
  }

  if (sent) {
    return <p className="form-thanks">{t("Received. I’ll write back.", "Получено. Я отвечу.")}</p>;
  }

  return (
    <form className="glass-form" onSubmit={handleSubmit}>
      <label>
        {t("Name", "Имя")}
        <input name="name" required autoComplete="name" />
      </label>
      <label>
        {t("Email", "Почта")}
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        {t("Message", "Сообщение")}
        <textarea name="message" rows={4} required />
      </label>
      <button className="submit-btn" type="submit">
        {t("Send", "Отправить")}
      </button>
    </form>
  );
}
