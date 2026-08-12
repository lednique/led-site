import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { sanitizeSvg } from "../lib/files";

type NavButtonProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  svg?: string;
  children?: ReactNode;
};

export function NavButton({ label, active, onClick, href, svg, children }: NavButtonProps) {
  const className = `nav-btn${active ? " is-active" : ""}`;
  const inner = (
    <>
      <span className="nav-btn-pill" />
      {svg ? (
        <span className="nav-btn-icon" dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }} />
      ) : (
        <span className="nav-btn-icon">{children}</span>
      )}
    </>
  );

  if (href) {
    const external = /^https?:|mailto:/i.test(href);
    if (external) {
      return (
        <a className={className} href={href} target="_blank" rel="noreferrer" aria-label={label}>
          {inner}
        </a>
      );
    }
    return (
      <Link className={className} to={href} aria-label={label}>
        {inner}
      </Link>
    );
  }

  return (
    <button className={className} type="button" onClick={onClick} aria-label={label} aria-pressed={active}>
      {inner}
    </button>
  );
}
