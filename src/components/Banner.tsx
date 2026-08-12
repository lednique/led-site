import { Link } from "react-router-dom";
import { resolveSrc } from "../media";
import type { BannerData } from "../types";
import { FaceMark } from "./FaceMark";

type BannerProps = {
  data: BannerData;
  variant: "rail" | "hero";
};

export function Banner({ data, variant }: BannerProps) {
  const img = resolveSrc(data.image);
  const inner = (
    <>
      <div className="banner-copy">
        <div className="banner-brand">
          <FaceMark />
          <span>{data.brand}</span>
        </div>
        <p className="banner-title">
          {data.title.split("\n").map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </p>
        <p className="banner-cta">{data.cta}</p>
      </div>
      {variant === "rail" && <div className="banner-rule" />}
    </>
  );

  const className = `banner banner--${variant}`;
  const style = { backgroundImage: `url(${img})` };

  if (data.url) {
    const external = /^https?:|mailto:/i.test(data.url);
    if (external) {
      return (
        <a className={className} style={style} href={data.url} target="_blank" rel="noreferrer">
          {inner}
        </a>
      );
    }
    return (
      <Link className={className} style={style} to={data.url}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={className} style={style}>
      {inner}
    </div>
  );
}
