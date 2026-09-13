import { useI18n } from "../i18n";
import { cardSurface } from "../lib/color";
import { resolveSrc } from "../media";
import type { Publication, SocialItem } from "../types";
import { LinkIcon } from "./Icons";

type CardProps = {
  item: Publication;
  onOpen: () => void;
  isOpen?: boolean;
  /** Позиция карточки в ленте — задаёт задержку «домино» при появлении. */
  index?: number;
};

export function PublicationCard({ item, onOpen, isOpen, index = 0 }: CardProps) {
  const { loc } = useI18n();
  const isLink = item.type === "link";

  return (
    <button
      type="button"
      className={`card card--enter${isLink ? " card--link" : " card--article"}${isOpen ? " is-open" : ""}`}
      style={{ ...cardSurface(item.color), animationDelay: `${index * 100}ms` }}
      onClick={onOpen}
    >
      <div className="card-body">
        <div className="card-title">{loc(item.title)}</div>
        {item.image ? <img className="card-img" src={resolveSrc(item.image)} alt="" /> : <div className="card-img card-img--empty" />}
      </div>
      <span className="card-chrome" aria-hidden />
      {isLink ? (
        <>
          <div className="card-link-fade" />
          <span className="card-ripple" aria-hidden />
          <span className="card-link-btn" aria-hidden>
            <span className="nav-btn-pill" />
            <span className="nav-btn-icon">
              <LinkIcon />
            </span>
          </span>
        </>
      ) : (
        <span className="card-hover">
          <span>{isOpen ? "CLOSE" : "OPEN"}</span>
        </span>
      )}
    </button>
  );
}

export function CardSkeleton() {
  return (
    <div className="card card-skeleton" aria-hidden>
      <div className="card-body">
        <div className="skel skel-title" />
        <div className="skel skel-img" />
      </div>
    </div>
  );
}

export function SocialCard({ items }: { items: SocialItem[] }) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <div className="social-card card--enter" style={{ animationDelay: "0ms" }}>
      <div className="card-body">
        <div className="card-title">{t("Social Networks", "Соцсети")}</div>
        <div className="social-well">
          {items.slice(0, 6).map((s) => (
            <a key={s.id} className="social-dot" href={s.url} target="_blank" rel="noreferrer" aria-label={s.label.en}>
              <img src={resolveSrc(s.image)} alt="" />
            </a>
          ))}
        </div>
      </div>
      <span className="card-chrome" aria-hidden />
    </div>
  );
}
