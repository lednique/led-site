import { LinkIcon } from "./Icons";
import { cardSurface, isLightColor } from "../lib/color";
import { resolveSrc } from "../media";
import type { Publication, SocialItem } from "../types";

type CardProps = {
  item: Publication;
  onOpen: () => void;
  isOpen?: boolean;
};

export function PublicationCard({ item, onOpen, isOpen }: CardProps) {
  const light = isLightColor(item.color);
  const isLink = item.type === "link";

  return (
    <button
      type="button"
      className={`card${isLink ? " card--link" : " card--article"}${light ? " is-light" : ""}${isOpen ? " is-open" : ""}`}
      style={cardSurface(item.color)}
      onClick={onOpen}
    >
      <div className="card-body">
        <div className="card-title">{item.title}</div>
        <img className="card-img" src={resolveSrc(item.image)} alt="" />
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

export function SocialCard({ items }: { items: SocialItem[] }) {
  return (
    <div className="social-card">
      <div className="card-body">
        <div className="card-title">Social Networks</div>
        <div className="social-well">
          {items.slice(0, 6).map((s) => (
            <a key={s.id} className="social-dot" href={s.url} target="_blank" rel="noreferrer" aria-label={s.label}>
              <img src={resolveSrc(s.image)} alt="" />
            </a>
          ))}
        </div>
      </div>
      <span className="card-chrome" aria-hidden />
    </div>
  );
}
