import { useNavigate } from "react-router-dom";
import { MENU_PAGES } from "../defaults";
import { useI18n } from "../i18n";
import type { MenuPageKey } from "../types";

type MenuPanelProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Верхнее меню мобильной шапки. Выезжает сверху, сдвигая страницу вниз.
 * Содержит три страницы (Обо мне, Заказать работу, Контакты), а также перенос
 * переключателя языка и подписи © LEDNIQUE — на десктопе они остаются в подвале.
 */
export function MenuPanel({ open, onClose }: MenuPanelProps) {
  const navigate = useNavigate();
  const { locale, setLocale, t } = useI18n();

  function go(key: MenuPageKey) {
    navigate(`/m/${key}`);
    onClose();
  }

  return (
    <div className={`menu-panel${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="menu-items">
        {MENU_PAGES.map((p) => (
          <button
            key={p.key}
            type="button"
            className="menu-item"
            onClick={() => go(p.key)}
          >
            <span className="menu-item-text">{locale === "ru" ? p.label.ru : p.label.en}</span>
          </button>
        ))}
      </div>
      <div className="menu-foot">
        <button
          type="button"
          className="lang-switch"
          onClick={() => setLocale(locale === "en" ? "ru" : "en")}
        >
          {locale === "en" ? "EN" : "RU"}
        </button>
        <span className="lang-dot"> · </span>
        {t("© LEDNIQUE — 2026. All Rights Reserved.", "© LEDNIQUE — 2026. Все права защищены.")}
      </div>
    </div>
  );
}
