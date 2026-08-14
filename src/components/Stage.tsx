import { useEffect, useState, type UIEvent } from "react";
import type { BannerData, Publication } from "../types";
import { ArticleView } from "./ArticleView";
import { Banner } from "./Banner";
import { CloseIcon } from "./Icons";
import { NavButton } from "./NavButton";

type StageProps = {
  banner: BannerData;
  article?: Publication;
  onClose: () => void;
};

export function Stage({ banner, article, onClose }: StageProps) {
  const [readerScrolled, setReaderScrolled] = useState(false);

  useEffect(() => {
    setReaderScrolled(false);
  }, [article?.id]);

  function handleReaderScroll(event: UIEvent<HTMLDivElement>) {
    const next = event.currentTarget.scrollTop > 0;
    setReaderScrolled((current) => (current === next ? current : next));
  }

  return (
    <section className={`stage${article ? " is-open" : ""}`}>
      {article ? (
        <>
          <div className="stage-close">
            <NavButton label="Close" onClick={onClose}>
              <CloseIcon />
            </NavButton>
          </div>
          <div
            key={article.id}
            className={`stage-reader${readerScrolled ? " is-scrolled" : ""}`}
            onScroll={handleReaderScroll}
          >
            <ArticleView pub={article} />
          </div>
        </>
      ) : (
        <Banner data={banner} variant="hero" />
      )}
    </section>
  );
}
