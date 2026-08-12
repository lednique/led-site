import type { BannerData, Publication } from "../types";
import { ArticleView } from "./ArticleView";
import { Banner } from "./Banner";

type StageProps = {
  banner: BannerData;
  article?: Publication;
  onClose: () => void;
};

export function Stage({ banner, article, onClose }: StageProps) {
  return (
    <section className={`stage${article ? " is-open" : ""}`}>
      {article ? (
        <div className="stage-reader">
          <ArticleView pub={article} onClose={onClose} />
        </div>
      ) : (
        <Banner data={banner} variant="hero" />
      )}
    </section>
  );
}
