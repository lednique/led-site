import { useState, type FormEvent } from "react";
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
  return (
    <article className="article">
      <div className="article-top">
        <p className="stage-kicker">{pub.type === "article" ? "Article" : "Link"}</p>
        <NavButton label="Close" onClick={onClose}>
          <CloseIcon />
        </NavButton>
      </div>
      <h1 className="stage-title">{pub.title}</h1>
      <div className="article-blocks">
        {pub.blocks.map((block) => {
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
  const [sent, setSent] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
  }

  if (sent) {
    return <p className="form-thanks">Received. I’ll write back.</p>;
  }

  return (
    <form className="glass-form" onSubmit={handleSubmit}>
      <label>
        Name
        <input name="name" required autoComplete="name" />
      </label>
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        Message
        <textarea name="message" rows={4} required />
      </label>
      <button className="submit-btn" type="submit">
        Send
      </button>
    </form>
  );
}
