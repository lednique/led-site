import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { visiblePublications } from "../store";
import type { SiteData } from "../types";
import { Banner } from "./Banner";
import { CardSkeleton, PublicationCard, SocialCard } from "./Cards";
import { DotsIcon } from "./Icons";
import { Logo } from "./Logo";
import { NavButton } from "./NavButton";

type SidebarProps = {
  data: SiteData;
  articleOpen: boolean;
  activeId?: string;
  onOpenArticle: (id: string) => void;
  onHome: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
};

const FIRST = 20;
const STEP = 10;

export function Sidebar({ data, articleOpen, activeId, onOpenArticle, onHome, menuOpen, onToggleMenu }: SidebarProps) {
  const navigate = useNavigate();
  const { locale, loc } = useI18n();
  const sidebarRef = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 799px)").matches);
  const [scrolled, setScrolled] = useState(false);
  const [limit, setLimit] = useState(FIRST);
  const [loadingMore, setLoadingMore] = useState(false);

  const all = useMemo(() => visiblePublications(data, locale), [data, locale]);
  const pubs = all.slice(0, limit);
  const hasMore = limit < all.length;

  useEffect(() => {
    setLimit(FIRST);
  }, [locale]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 799px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = mobile ? sidebarRef.current : scroller.current;
    if (!el) return;

    const onScroll = () => {
      if (!mobile) {
        setScrolled(el.scrollTop > 12);
        return;
      }

      const banner = el.querySelector(".rail-banner") as HTMLElement | null;
      setScrolled(window.scrollY > (banner?.offsetHeight ?? 250));
    };

    onScroll();
    const target: HTMLElement | Window = mobile ? window : el;
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [mobile]);

  useEffect(() => {
    const root = scroller.current;
    const node = sentinel.current;
    if (!node || (!mobile && !root)) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !hasMore || loadingMore) return;
        setLoadingMore(true);
        window.setTimeout(() => {
          setLimit((n) => n + STEP);
          setLoadingMore(false);
        }, 420);
      },
      { root: mobile ? null : root, rootMargin: "80px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, loadingMore, pubs.length, mobile]);

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

  const right = pubs.filter((_, i) => i % 2 === 0);
  const left = pubs.filter((_, i) => i % 2 === 1);

  return (
    <aside ref={sidebarRef} className={`sidebar${articleOpen ? " has-article" : ""}${scrolled ? " is-scrolled" : ""}`}>
      <div className="sidebar-blur" aria-hidden>
        <i style={{ ["--b" as string]: "36px", ["--a" as string]: "0%", ["--z" as string]: "58%" }} />
        <i style={{ ["--b" as string]: "24px", ["--a" as string]: "48%", ["--z" as string]: "72%" }} />
        <i style={{ ["--b" as string]: "14px", ["--a" as string]: "64%", ["--z" as string]: "84%" }} />
        <i style={{ ["--b" as string]: "6px", ["--a" as string]: "76%", ["--z" as string]: "94%" }} />
      </div>

      <div className={`rail-banner${articleOpen ? " is-on" : ""}`}>
        <Banner data={data.banner} variant="rail" />
        <button
          type="button"
          className={`menu-toggle${menuOpen ? " is-open" : ""}`}
          onClick={onToggleMenu}
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
        >
          <DotsIcon />
        </button>
      </div>

      <div className="top-chrome-slot">
        <div className="top-chrome">
          <header className="topbar">
            <div className="topbar-actions">
              {data.nav.slice(0, 4).map((btn) => (
                <NavButton key={btn.id} label={loc(btn.label)} href={btn.url} svg={btn.svg} />
              ))}
            </div>
            <Logo onClick={onHome} />
          </header>
          <div className={`sidebar-topfade${scrolled ? " is-on" : ""}`}>
            <button
              type="button"
              className="scroll-anchor"
              aria-label="Наверх"
              onClick={() =>
                mobile ? window.scrollTo({ top: 0, behavior: "smooth" }) : scroller.current?.scrollTo({ top: 0, behavior: "smooth" })
              }
            >
              <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden>
                <path d="M1 9L9 1L17 9" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="board-wrap">
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
              {loadingMore && <CardSkeleton />}
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
              {loadingMore && <CardSkeleton />}
            </div>
          </div>
          <div ref={sentinel} className="load-sentinel" />
        </div>
      </div>
    </aside>
  );
}
