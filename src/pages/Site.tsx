import { useNavigate, useParams } from "react-router-dom";
import { Banner } from "../components/Banner";
import { Sidebar } from "../components/Sidebar";
import { Stage } from "../components/Stage";
import { useSite } from "../store";

export function SitePage() {
  const data = useSite();
  const { id } = useParams();
  const navigate = useNavigate();
  const article = id ? data.publications.find((p) => p.id === id) : undefined;
  const open = Boolean(article);

  return (
    <div className="page">
      <div className="site">
        {!open && <Banner data={data.banner} variant="hero" />}
        <Sidebar
          data={data}
          articleOpen={open}
          activeId={article?.id}
          onOpenArticle={(next) => navigate(`/p/${next}`)}
          onHome={() => navigate("/")}
        />
        {open && <Stage banner={data.banner} article={article} onClose={() => navigate("/")} />}
        {open && article && (
          <div className="mobile-sheet">
            <Stage banner={data.banner} article={article} onClose={() => navigate("/")} />
          </div>
        )}
        <div className="page-footer">
          <p>
            © LEDNIQUE — 2026. All Rights Reserved.{" "}
            <a className="admin-link" href="/admin">
              panel
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
