import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { resolveSrc } from "../media";
import type { BannerData } from "../types";
import { FaceMark } from "./FaceMark";

type BannerProps = {
  data: BannerData;
  variant: "rail" | "hero";
};

export function Banner({ data, variant }: BannerProps) {
  const { loc } = useI18n();
  const blank =
    !data.image &&
    !data.brand?.en &&
    !data.brand?.ru &&
    !data.title?.en &&
    !data.title?.ru &&
    !data.cta?.en &&
    !data.cta?.ru;
  if (blank) return null;
  const img = resolveSrc(data.image);
  const copy = (
    <div className="banner-copy">
      <div className="banner-brand">
        <FaceMark />
        <span>{loc(data.brand)}</span>
      </div>
      <p className="banner-title">
        {loc(data.title)
          .split("\n")
          .map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
      </p>
      <p className="banner-cta">{loc(data.cta)}</p>
      <div className="banner-rule" />
    </div>
  );

  const className = `banner banner--${variant}`;

  const body =
    variant === "hero" ? (
      <>
        <div className="banner-media" style={{ backgroundImage: `url(${img})` }} />
        {copy}
      </>
    ) : (
      copy
    );

  const style = variant === "rail" ? { backgroundImage: `url(${img})` } : undefined;

  if (data.url) {
    const external = /^https?:|mailto:/i.test(data.url);
    if (external) {
      return (
        <a className={className} style={style} href={data.url} target="_blank" rel="noreferrer">
          {body}
        </a>
      );
    }
    return (
      <Link className={className} style={style} to={data.url}>
        {body}
      </Link>
    );
  }

  return (
    <div className={className} style={style}>
      {body}
    </div>
  );
}
