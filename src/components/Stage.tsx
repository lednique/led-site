import { useEffect, useState, type UIEvent } from "react";
import { pickLocale, useI18n } from "../i18n";
import type { BannerData, Publication } from "../types";
import { ArticleMediaProvider, useArticleMediaGate } from "./ArticleMedia";
import { ArticleView } from "./ArticleView";
import { Banner } from "./Banner";
import { CloseIcon } from "./Icons";
import { SiteLoader } from "./Loader";
import { NavButton } from "./NavButton";

type StageProps = {
  banner: BannerData;
  article?: Publication;
  onClose: () => void;
};

export function Stage({ banner, article, onClose }: StageProps) {
  return (
    <section className={`stage${article ? " is-open" : ""}`}>
      {article ? (
        <StageArticle key={article.id} article={article} onClose={onClose} />
      ) : (
        <Banner data={banner} variant="hero" />
      )}
    </section>
  );
}

function StageArticle({ article, onClose }: { article: Publication; onClose: () => void }) {
  const { locale } = useI18n();
  const [readerScrolled, setReaderScrolled] = useState(false);
  // Параллакс-видео должно быть готово к первому кадру до того, как статья
  // покажется: иначе прокрутка листает пустой чёрный прямоугольник.
  const gate = useArticleMediaGate(pickLocale(locale, article.blocks, article.enEnabled));

  useEffect(() => {
    setReaderScrolled(false);
  }, [article.id]);

  function handleReaderScroll(event: UIEvent<HTMLDivElement>) {
    const next = event.currentTarget.scrollTop > 0;
    setReaderScrolled((current) => (current === next ? current : next));
  }

  return (
    <ArticleMediaProvider value={gate}>
      <div className="stage-close">
        <NavButton label="Close" onClick={onClose}>
          <CloseIcon />
        </NavButton>
      </div>
      <div className={`stage-topfade${readerScrolled ? " is-on" : ""}`} aria-hidden="true" />
      <div className="stage-reader" onScroll={handleReaderScroll}>
        <ArticleView pub={article} />
      </div>
      {/* Экран загрузки статьи: держится, пока не готово параллакс-видео. */}
      {gate.holding ? <SiteLoader className="site-loader--stage" /> : null}
    </ArticleMediaProvider>
  );
}
