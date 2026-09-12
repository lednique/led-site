import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "../i18n";

const SEEN_KEY = "lednique-cookie-seen";
/** Сколько тост живёт на экране: появление + пара секунд + затухание. */
const LIFETIME = 4200;

/**
 * Полупрозрачное уведомление о cookie/localStorage. Показывается поверх
 * Splash Screen только при первом посещении: держится пару секунд и
 * плавно гаснет (анимация cookie-life в styles.css), после чего
 * демонтируется по таймеру.
 */
export function CookieNotice() {
  const { t } = useI18n();
  const location = useLocation();
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SEEN_KEY) !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!visible) return;
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    const timer = window.setTimeout(() => setVisible(false), LIFETIME);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="cookie-notice" role="status">
      <span>
        {t(
          "This site uses localStorage and third-party embedded content cookies. By continuing, you agree to the ",
          "Сайт использует localStorage и cookie встроенных сторонних сервисов. Продолжая, вы соглашаетесь с ",
        )}
      </span>
      <Link to="/privacy" state={{ from: location.pathname }}>
        {t("privacy policy", "политикой конфиденциальности")}
      </Link>
      <span>.</span>
    </div>
  );
}
