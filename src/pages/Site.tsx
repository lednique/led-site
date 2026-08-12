import { useNavigate, useParams } from "react-router-dom";
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
        <Sidebar
          data={data}
          articleOpen={open}
          onOpenArticle={(next) => navigate(`/p/${next}`)}
          onHome={() => navigate("/")}
        />
        <Stage banner={data.banner} article={article} onClose={() => navigate("/")} />
        {open && article && (
          <div className="mobile-sheet">
            <Stage banner={data.banner} article={article} onClose={() => navigate("/")} />
          </div>
        )}
      </div>
    </div>
  );
}
