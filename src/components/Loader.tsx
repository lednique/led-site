import { useMemo, type CSSProperties } from "react";
import { resolveSrc } from "../media";
import { useSplashBackground } from "../store";
import { LogoMark } from "./Logo";

/**
 * Полноэкранный загрузчик, который показывается, пока данные сайта
 * не подтянутся из Supabase и не загрузятся первые карточки.
 * Логотип переливается чёрно-белым градиентом, фон настраивается
 * в панели управления (заливка или изображение).
 *
 * `className="site-loader--stage"` превращает его в экран загрузки статьи:
 * тот же вид, но перекрывает только область статьи, а не весь сайт.
 */
export function SiteLoader({ className = "" }: { className?: string } = {}) {
  const splash = useSplashBackground();

  const style = useMemo<CSSProperties>(() => {
    if (splash.type === "image" && splash.image) {
      // Лёгкая затемняющая подложка, чтобы белый логотип оставался читаемым
      // на любом изображении.
      return {
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.35)), url(${resolveSrc(splash.image)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return { background: splash.color || "#000000" };
  }, [splash]);

  return (
    <div className={`site-loader${className ? ` ${className}` : ""}`} style={style} role="status" aria-label="Загрузка сайта">
      <div className="site-loader-mark">
        <LogoMark className="site-loader-svg" />
        <span className="site-loader-sheen" aria-hidden />
      </div>
    </div>
  );
}
