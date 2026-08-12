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
  onOpenArticle: (id: string) => void;
  onHome: () => void;
};

export function Sidebar({ data, articleOpen, onOpenArticle, onHome }: SidebarProps) {
  const navigate = useNavigate();
  const pubs = sortedPublications(data);
  const left = pubs.filter((_, i) => i % 2 === 0);
  const right = pubs.filter((_, i) => i % 2 === 1);

  function handleCard(id: string, type: "link" | "article", url?: string) {
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
    <aside className={`sidebar${articleOpen ? " has-article" : ""}`}>
      <div className="sidebar-scroll">
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

        <div className="board">
          <div className="col">
            <SocialCard items={data.socials} />
            {left.map((item) => (
              <PublicationCard key={item.id} item={item} onOpen={() => handleCard(item.id, item.type, item.url)} />
            ))}
          </div>
          <div className="col">
            {right.map((item) => (
              <PublicationCard key={item.id} item={item} onOpen={() => handleCard(item.id, item.type, item.url)} />
            ))}
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        <p>
          © LEDNIQUE — 2026. All Rights Reserved.{" "}
          <a className="admin-link" href="/admin">
            panel
          </a>
        </p>
      </div>
    </aside>
  );
}
