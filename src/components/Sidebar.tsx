import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sortedPublications } from "../store";
import type { SiteData } from "../types";
import { Banner } from "./Banner";
import { PublicationCard, SocialCard } from "./Cards";
import { Logo } from "./Logo";
import { NavButton } from "./NavButton";

type SidebarProps = {
  data: SiteData;
  articleOpen: boolean;
  activeId?: string;
  onOpenArticle: (id: string) => void;
  onHome: () => void;
};

export function Sidebar({ data, articleOpen, activeId, onOpenArticle, onHome }: SidebarProps) {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const pubs = sortedPublications(data);
  const right = pubs.filter((_, i) => i % 2 === 0);
  const left = pubs.filter((_, i) => i % 2 === 1);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 12);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function handleCard(id: string, type: "link" | "article", url?: string) {
    if (type === "article" && activeId === id) {
      onHome();
      return;
    }
    if (type === "link") {
      if (!url) return;
      if (/^https?:|mailto:/i.test(url)) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      navigate(url);
      return;
    }
    onOpenArticle(id);
  }

  return (
    <aside className={`sidebar${articleOpen ? " has-article" : ""}${scrolled ? " is-scrolled" : ""}`}>
      <div className="sidebar-blur" aria-hidden>
        <i style={{ ["--b" as string]: "36px", ["--a" as string]: "0%", ["--z" as string]: "58%" }} />
        <i style={{ ["--b" as string]: "24px", ["--a" as string]: "48%", ["--z" as string]: "72%" }} />
        <i style={{ ["--b" as string]: "14px", ["--a" as string]: "64%", ["--z" as string]: "84%" }} />
        <i style={{ ["--b" as string]: "6px", ["--a" as string]: "76%", ["--z" as string]: "94%" }} />
      </div>

      <div className={`rail-banner${articleOpen ? " is-on" : ""}`}>
        <Banner data={data.banner} variant="rail" />
      </div>

      <header className="topbar">
        <div className="topbar-actions">
          {data.nav.slice(0, 4).map((btn) => (
            <NavButton key={btn.id} label={btn.label} href={btn.url} svg={btn.svg} />
          ))}
        </div>
        <Logo onClick={onHome} />
      </header>

      <div className="board-wrap">
        <div className={`sidebar-topfade${scrolled ? " is-on" : ""}`}>
          <button
            type="button"
            className="scroll-anchor"
            aria-label="Наверх"
            onClick={() => scroller.current?.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden>
              <path d="M1 9L9 1L17 9" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="sidebar-scroll" ref={scroller}>
          <div className="board">
            <div className="col">
              <SocialCard items={data.socials} />
              {left.map((item) => (
                <PublicationCard
                  key={item.id}
                  item={item}
                  isOpen={activeId === item.id}
                  onOpen={() => handleCard(item.id, item.type, item.url)}
                />
              ))}
            </div>
            <div className="col">
              {right.map((item) => (
                <PublicationCard
                  key={item.id}
                  item={item}
                  isOpen={activeId === item.id}
                  onOpen={() => handleCard(item.id, item.type, item.url)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
