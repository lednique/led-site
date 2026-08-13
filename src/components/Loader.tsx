import { LogoMark } from "./Logo";

/**
 * Полноэкранный загрузчик, который показывается, пока данные сайта
 * не подтянутся из Supabase. Логотип переливается чёрно-белым градиентом.
 */
export function SiteLoader() {
  return (
    <div className="site-loader" role="status" aria-label="Загрузка сайта">
      <div className="site-loader-mark">
        <LogoMark className="site-loader-svg" />
        <span className="site-loader-sheen" aria-hidden />
      </div>
    </div>
  );
}
