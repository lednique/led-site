import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BlockEditor } from "../admin/BlockEditor";
import { Field, HashtagField, ImagePick, SvgPick, TextArea, TextInput } from "../admin/fields";
import { DEFAULT_ACCENT, MENU_PAGES, pageLabel, pageMail } from "../defaults";
import { cardSurface, uid } from "../lib/color";
import { alignPublicationBlocks, copyBlocks, mirrorText, syncBlocks } from "../lib/mirror";
import { hasSupabase, supabase } from "../lib/supabase";
import { formatBytes } from "../lib/files";
import { BANNER_MAX_BYTES } from "../lib/upload";
import { resolveSrc } from "../media";
import {
  movePublication,
  patchSite,
  removePublication,
  savePublication,
  saveSiteSettings,
  sortedPublications,
  useSite,
  useSyncState,
} from "../store";
import type {
  ArticleBlock,
  Locale,
  Localized,
  MailTemplate,
  MenuPageKey,
  NavItem,
  Publication,
  SocialItem,
} from "../types";

type Tab = "cards" | "banner" | "buttons" | "menu";

export function AdminPage() {
  const data = useSite();
  const sync = useSyncState();
  const [tab, setTab] = useState<Tab>("cards");
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("led-admin") === "1");
  const [email, setEmail] = useState(() => (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  /**
   * Если Supabase подключён, вход в панель = сессия Supabase Auth.
   * Именно она даёт право писать в базу и в Storage (политики RLS настроены
   * на роль `authenticated`), поэтому пароль больше не «прячет интерфейс»,
   * а реально защищает содержимое сайта. Существующая сессия переживает
   * перезагрузку страницы — supabase-js хранит её в localStorage.
   */
  useEffect(() => {
    if (!hasSupabase() || !supabase) return;
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      sessionStorage.setItem("led-admin", "1");
      setAuthed(true);
      setEmail(data.session.user.email ?? "");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setAuthed(Boolean(session));
      if (session) sessionStorage.setItem("led-admin", "1");
      else sessionStorage.removeItem("led-admin");
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  /** Выход: гасим сессию Supabase (или просто снимаем локальный флаг). */
  async function logout() {
    if (hasSupabase() && supabase) await supabase.auth.signOut();
    sessionStorage.removeItem("led-admin");
    setAuthed(false);
    setPassword("");
    setError("");
  }

  /** Единственная кнопка сохранения всех настроек сайта (баннер, кнопки, меню…). */
  async function onSaveSettings() {
    if (saving) return;
    setSaving(true);
    try {
      if (await saveSiteSettings()) {
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (loggingIn) return;
    setLoggingIn(true);
    try {
      // Основной вариант — Supabase Auth: сессия даёт право на запись в базу.
      if (hasSupabase() && supabase) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) {
          setError(
            authError.message === "Invalid login credentials"
              ? "Неверная почта или пароль"
              : `Не удалось войти: ${authError.message}`,
          );
          return;
        }
        sessionStorage.setItem("led-admin", "1");
        setAuthed(true);
        return;
      }

      // Сайт без Supabase — запасной вход (демо-режим): серверная переменная
      // ADMIN_PASSWORD на Vercel или локальная VITE_ADMIN_PASSWORD.
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        sessionStorage.setItem("led-admin", "1");
        setAuthed(true);
        return;
      }
      if (res.status === 404) {
        const local = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined;
        if (local && password === local) {
          sessionStorage.setItem("led-admin", "1");
          setAuthed(true);
          return;
        }
      }
      setError(res.status === 429 ? "Слишком много попыток. Попробуйте позже." : "Неверный пароль");
    } catch {
      const local = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined;
      if (local && password === local) {
        sessionStorage.setItem("led-admin", "1");
        setAuthed(true);
        return;
      }
      setError("Нет связи с сервером. Для локальной работы задайте VITE_ADMIN_PASSWORD.");
    } finally {
      setLoggingIn(false);
    }
  }

  if (!authed) {
    const withSupabase = hasSupabase();
    return (
      <div className="admin admin-gate">
        <form className="ad-editor" onSubmit={login}>
          <p className="ad-kicker">LEDNIQUE</p>
          <h1>Панель</h1>
          {withSupabase && (
            <Field label="Почта">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </Field>
          )}
          <Field label="Пароль">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus={!withSupabase}
              required
            />
          </Field>
          {withSupabase && (
            <p className="ad-hint">
              Вход через Supabase Auth: пользователь создаётся в дашборде Supabase
              (Authentication → Users → Add user). Без сессии база доступна только на чтение.
            </p>
          )}
          {error && <p className="ad-hint">{error}</p>}
          <button className="ad-btn" type="submit" disabled={loggingIn}>
            {loggingIn ? "Входим…" : "Войти"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="ad-top">
        <div>
          <p className="ad-kicker">LEDNIQUE</p>
          <h1>Панель управления</h1>
        </div>
        <div className="ad-top-actions">
          <p className={`ad-sync ad-sync--${sync.mode}${sync.error ? " is-error" : ""}${sync.dirty ? " is-dirty" : ""}`}>
            {sync.dirty
              ? "Есть несохранённые изменения · нажмите «Сохранить»"
              : sync.mode === "live" && !sync.error
                ? sync.migrated
                  ? "Локальные данные опубликованы в базу"
                  : "Supabase · настройки сохраняются кнопкой «Сохранить»"
                : sync.mode === "offline"
                  ? `Нет связи с базой${sync.error ? ` · ${sync.error}` : ""}`
                  : "Только это устройство · задайте VITE_SUPABASE_URL"}
          </p>
          <button
            type="button"
            className={`ad-btn ad-btn--save${sync.dirty ? " is-dirty" : ""}`}
            onClick={onSaveSettings}
            disabled={saving}
          >
            {savedFlash ? "Сохранено ✓" : saving ? "Сохраняю…" : "Сохранить"}
          </button>
          <Link className="ad-btn" to="/" target="_blank" rel="noreferrer">
            К сайту
          </Link>
          <button type="button" className="ad-btn ad-btn--save" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      <nav className="ad-tabs">
        {(
          [
            ["cards", "Карточки"],
            ["banner", "Баннер"],
            ["buttons", "Кнопки"],
            ["menu", "Меню"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "cards" && <CardsTab />}
      {tab === "banner" && (
        <>
        <section className="ad-favicon-block">
          <ImagePick
            label="Иконка вкладки браузера"
            variant="icon"
            folder="favicon"
            maxSize={256}
            mime="image/png"
            clearable
            value={data.favicon}
            onChange={(favicon) => patchSite({ favicon })}
          />
          <p className="ad-hint">
            Квадратная картинка (PNG, SVG или JPG). Показывается на вкладке браузера и на телефоне у закладки.
          </p>
        </section>
        <section className="ad-splash-block">
          <h3>Фон Splash-Screen</h3>
          <div className="ad-type">
            <button
              type="button"
              className={data.splash.type === "color" ? "is-on" : ""}
              onClick={() => patchSite({ splash: { ...data.splash, type: "color" } })}
            >
              Заливка
            </button>
            <button
              type="button"
              className={data.splash.type === "image" ? "is-on" : ""}
              onClick={() => patchSite({ splash: { ...data.splash, type: "image" } })}
            >
              Изображение
            </button>
          </div>
          {data.splash.type === "color" ? (
            <Field label="Цвет фона">
              <div className="ad-color">
                <input
                  type="color"
                  value={data.splash.color}
                  onChange={(e) => patchSite({ splash: { ...data.splash, color: e.target.value } })}
                />
                <TextInput
                  value={data.splash.color}
                  onChange={(e) => patchSite({ splash: { ...data.splash, color: e.target.value } })}
                  placeholder="#000000"
                />
                <span className="ad-color-swatch" style={{ background: data.splash.color }} />
              </div>
            </Field>
          ) : (
            <ImagePick
              label="Изображение фона"
              variant="wide"
              folder="banner"
              value={data.splash.image}
              onChange={(image) => patchSite({ splash: { ...data.splash, image } })}
              clearable
            />
          )}
          <p className="ad-hint">
            Показывается на экране загрузки сайта. Заливка цветом или фоновое изображение
            (растягивается на весь экран, логотип остаётся по центру).
          </p>
        </section>
        <section className="ad-banner-layout">
          <ImagePick
            label="Изображение баннера"
            variant="tall"
            folder="banner"
            keepDimensions
            maxBytes={BANNER_MAX_BYTES}
            value={data.banner.image}
            onChange={(image) => patchSite({ banner: { ...data.banner, image } })}
          />
          <div className="ad-i18n-grid">
            <div className="ad-i18n-head">
              <span />
              <span>English</span>
              <span>Русский</span>
            </div>
            <LocalePair
              label="FaceShop / бренд"
              value={data.banner.brand}
              onChange={(brand) => patchSite({ banner: { ...data.banner, brand } })}
            />
            <LocalePair
              label="Заголовок"
              area
              value={data.banner.title}
              onChange={(title) => patchSite({ banner: { ...data.banner, title } })}
            />
            <LocalePair
              label="Подпись"
              value={data.banner.cta}
              onChange={(cta) => patchSite({ banner: { ...data.banner, cta } })}
            />
            <Field label="Ссылка баннера">
              <TextInput
                value={data.banner.url}
                onChange={(e) => patchSite({ banner: { ...data.banner, url: e.target.value } })}
              />
            </Field>
          </div>
        </section>
        <p className="ad-hint ad-banner-hint">
          Картинка баннера хранится в исходном размере — панель её не уменьшает. Ограничение только по весу:
          файл тяжелее {formatBytes(BANNER_MAX_BYTES)} будет пережат в JPEG с максимально возможным качеством при
          том же разрешении. Обрезку под макет (390×250 в рейле, вся правая часть экрана на компьютере) делает
          сам сайт, поэтому загружайте оригинал целиком.
        </p>
        </>
      )}
      {tab === "buttons" && <ButtonsTab />}
      {tab === "menu" && <MenuTab />}
    </div>
  );
}

function LocalePair({
  label,
  value,
  onChange,
  area,
}: {
  label: string;
  value: Localized;
  onChange: (next: Localized) => void;
  area?: boolean;
}) {
  const Input = area ? TextArea : TextInput;
  return (
    <div className="ad-i18n-row">
      <span className="ad-i18n-label">{label}</span>
      <Input value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />
      <Input value={value.ru} onChange={(e) => onChange({ ...value, ru: e.target.value })} />
    </div>
  );
}

function CardsTab() {
  const data = useSite();
  const pubs = useMemo(() => sortedPublications(data), [data]);
  const [editId, setEditId] = useState<string | null>(pubs[0]?.id ?? null);
  const [draft, setDraft] = useState<Publication | null>(null);
  const current = draft ?? pubs.find((p) => p.id === editId) ?? null;

  // После удаления открываем следующую доступную карточку, а не оставляем
  // справа пустой редактор с id уже удалённой публикации.
  useEffect(() => {
    if (!draft && !pubs.some((p) => p.id === editId)) {
      setEditId(pubs[0]?.id ?? null);
    }
  }, [draft, editId, pubs]);

  return (
    <div className="ad-split">
      <aside className="ad-list">
        <button
          type="button"
          className="ad-btn ad-btn-full"
          onClick={() => {
            const next = blankPub();
            setDraft(next);
            setEditId(next.id);
          }}
        >
          + Новая публикация
        </button>
        {pubs.map((p, index) => (
          <div
            key={p.id}
            className={`ad-list-item${editId === p.id && !draft ? " is-on" : ""}`}
            onClick={() => {
              setDraft(null);
              setEditId(p.id);
            }}
          >
            {p.image ? <img src={resolveSrc(p.image)} alt="" /> : <i className="ad-thumb-empty" />}
            <div>
              <strong>{p.title.ru || p.title.en}</strong>
              <span>
                {p.type === "link" ? "Ссылка" : "Статья"} · {new Date(p.createdAt).toLocaleDateString("ru-RU")}
              </span>
            </div>
            <i style={cardSurface(p.color)} />
            <div className="ad-order">
              <button
                type="button"
                aria-label="Выше"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  movePublication(p.id, -1);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Ниже"
                disabled={index === pubs.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  movePublication(p.id, 1);
                }}
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </aside>
      <div className="ad-editor">
        {current && (
          <CardForm
            key={current.id}
            initial={current}
            isNew={Boolean(draft)}
            onSaved={(id) => {
              setDraft(null);
              setEditId(id);
            }}
          />
        )}
      </div>
    </div>
  );
}

function blankPub(): Publication {
  const id = uid("pub");
  // Обе версии стартуют с одинаковой структурой и одинаковым текстом:
  // русская вкладка получает английский текст, пока его не перевели.
  const blocks: ArticleBlock[] = [{ id: uid("b"), type: "heading", text: "Heading" }];
  return {
    id,
    createdAt: Date.now(),
    order: -1,
    title: { en: "New publication", ru: "New publication" },
    type: "article",
    color: DEFAULT_ACCENT,
    image: "",
    url: "",
    hashtags: [],
    enEnabled: true,
    blocks: { en: blocks, ru: copyBlocks(blocks) },
  };
}

function CardForm({
  initial,
  isNew,
  onSaved,
}: {
  initial: Publication;
  isNew: boolean;
  onSaved: (id: string) => void;
}) {
  const [pub, setPub] = useState<Publication>(() => ({
    ...initial,
    blocks: alignPublicationBlocks(initial.blocks, "en"),
  }));
  const [lang, setLang] = useState<Locale>("en");

  useEffect(() => {
    if (!pub.enEnabled && lang === "en") setLang("ru");
  }, [pub.enEnabled, lang]);

  function patch(partial: Partial<Publication>) {
    setPub((p) => ({ ...p, ...partial }));
  }

  /** Заголовок: правим текущую вкладку, соседняя подхватывает текст, пока её не перевели. */
  function patchTitle(value: string) {
    setPub((p) => ({ ...p, title: mirrorText(p.title, lang, value) }));
  }

  /**
   * Блоки статьи: структура (набор, порядок, типы), путь к изображению и адрес
   * ссылки всегда одинаковы в обеих вкладках. Текст копируется в соседнюю
   * версию, пока его там не изменили вручную.
   */
  function patchBlocks(next: ArticleBlock[]) {
    setPub((p) => {
      const other = lang === "en" ? "ru" : "en";
      const mirrored = syncBlocks(p.blocks[lang], next, p.blocks[other], lang);
      return {
        ...p,
        blocks: lang === "en" ? { en: next, ru: mirrored } : { ru: next, en: mirrored },
      };
    });
  }

  return (
    <form
      className="ad-form"
      onSubmit={(e) => {
        e.preventDefault();
        savePublication(pub);
        onSaved(pub.id);
      }}
    >
      <div className="ad-lang-row">
        <label className="ad-check">
          <input type="checkbox" checked={pub.enEnabled} onChange={(e) => patch({ enEnabled: e.target.checked })} />
          Английская версия
        </label>
        <div className="ad-type">
          <button type="button" className={lang === "en" ? "is-on" : ""} disabled={!pub.enEnabled} onClick={() => setLang("en")}>
            Английская версия
          </button>
          <button type="button" className={lang === "ru" ? "is-on" : ""} onClick={() => setLang("ru")}>
            Русская версия
          </button>
        </div>
      </div>

      <div className="ad-card-layout">
        <ImagePick label="Изображение" variant="tall" folder="cards" value={pub.image} onChange={(image) => patch({ image })} />
        <div className="ad-card-fields">
          <Field label="Заголовок карточки">
            <TextInput value={pub.title[lang]} onChange={(e) => patchTitle(e.target.value)} required />
          </Field>

          <div className="ad-type">
            <button type="button" className={pub.type === "article" ? "is-on" : ""} onClick={() => patch({ type: "article" })}>
              Статья
            </button>
            <button type="button" className={pub.type === "link" ? "is-on" : ""} onClick={() => patch({ type: "link" })}>
              Ссылка
            </button>
          </div>

          <Field label="Цвет акцента карточки">
            <div className="ad-color">
              <input type="color" value={pub.color} onChange={(e) => patch({ color: e.target.value })} />
              <TextInput value={pub.color} onChange={(e) => patch({ color: e.target.value })} />
              <span className="ad-color-swatch" style={cardSurface(pub.color)} />
            </div>
          </Field>

          <HashtagField value={pub.hashtags} onChange={(hashtags) => patch({ hashtags })} />
        </div>
      </div>

      {pub.type === "link" && (
        <Field label="URL">
          <TextInput value={pub.url ?? ""} onChange={(e) => patch({ url: e.target.value })} placeholder="https://" />
        </Field>
      )}

      {pub.type === "article" && (
        <div className="ad-article">
          <h3>Редактор статьи · {lang === "en" ? "EN" : "RU"}</h3>
          <p className="ad-hint">
            Блоки с шагом 10 px. Текст — Markdown. Структура, изображения и ссылки общие для обеих версий:
            добавленный блок сразу появляется во второй вкладке с тем же текстом, пока его не перевели.
          </p>
          <BlockEditor blocks={pub.blocks[lang]} onChange={patchBlocks} />
        </div>
      )}

      <div className="ad-form-actions">
        <button className="ad-btn" type="submit">
          {isNew ? "Создать" : "Сохранить"}
        </button>
        {!isNew && (
          <button
            type="button"
            className="ad-ghost danger"
            onClick={async () => {
              if (!confirm("Удалить публикацию?")) return;
              if (!(await removePublication(pub.id))) {
                window.alert("Не удалось удалить публикацию. Подробности показаны в статусе подключения сверху.");
              }
            }}
          >
            Удалить
          </button>
        )}
      </div>
    </form>
  );
}

function ButtonsTab() {
  const data = useSite();

  function setNav(nav: NavItem[]) {
    patchSite({ nav: nav.slice(0, 4) });
  }

  function setSocials(socials: SocialItem[]) {
    patchSite({ socials: socials.slice(0, 6) });
  }

  return (
    <div className="ad-grid ad-grid-2">
      <section>
        <h3>Рядом с логотипом · до 4</h3>
        {data.nav.map((btn, i) => (
          <div key={btn.id} className="ad-item-card ad-item-card--row">
            <SvgPick
              label="SVG иконка"
              value={btn.svg}
              onChange={(svg) => setNav(data.nav.map((b, n) => (n === i ? { ...b, svg } : b)))}
            />
            <div className="ad-item-fields">
              <LocalePair
                label="Название"
                value={btn.label}
                onChange={(label) => setNav(data.nav.map((b, n) => (n === i ? { ...b, label } : b)))}
              />
              <Field label="Ссылка">
                <TextInput
                  value={btn.url}
                  onChange={(e) => setNav(data.nav.map((b, n) => (n === i ? { ...b, url: e.target.value } : b)))}
                />
              </Field>
              <button type="button" className="ad-ghost danger" onClick={() => setNav(data.nav.filter((_, n) => n !== i))}>
                Удалить
              </button>
            </div>
          </div>
        ))}
        {data.nav.length < 4 && (
          <button
            type="button"
            className="ad-btn"
            onClick={() =>
              setNav([
                ...data.nav,
                { id: uid("nav"), label: { en: "Button", ru: "Кнопка" }, url: "https://", svg: "" },
              ])
            }
          >
            + Кнопка
          </button>
        )}
      </section>

      <section>
        <h3>Соцсети · до 6 · сетка 2×3</h3>
        {data.socials.map((s, i) => (
          <div key={s.id} className="ad-item-card ad-item-card--row">
            <ImagePick
              label="Иконка / фото"
              variant="icon"
              folder="socials"
              value={s.image}
              onChange={(image) => setSocials(data.socials.map((x, n) => (n === i ? { ...x, image } : x)))}
            />
            <div className="ad-item-fields">
              <LocalePair
                label="Название"
                value={s.label}
                onChange={(label) => setSocials(data.socials.map((x, n) => (n === i ? { ...x, label } : x)))}
              />
              <Field label="Ссылка">
                <TextInput
                  value={s.url}
                  onChange={(e) => setSocials(data.socials.map((x, n) => (n === i ? { ...x, url: e.target.value } : x)))}
                />
              </Field>
              <button
                type="button"
                className="ad-ghost danger"
                onClick={() => setSocials(data.socials.filter((_, n) => n !== i))}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
        {data.socials.length < 6 && (
          <button
            type="button"
            className="ad-btn"
            onClick={() =>
              setSocials([
                ...data.socials,
                { id: uid("soc"), label: { en: "Social", ru: "Соцсеть" }, url: "https://", image: "builtin:ig" },
              ])
            }
          >
            + Ссылка
          </button>
        )}
      </section>
    </div>
  );
}

function MenuTab() {
  const data = useSite();
  const [editKey, setEditKey] = useState<MenuPageKey>("about");

  return (
    <div className="ad-split">
      <aside className="ad-list">
        <p className="ad-hint">
          Три кнопки верхнего меню. Откройте, чтобы править название и статью — как карточку, но без картинки, цвета и типа. У кнопки «Заказать работу» вместо статьи — тема и текст письма.
        </p>
        {MENU_PAGES.map((p) => {
          const label = pageLabel(data.pages, p.key);
          return (
            <div
              key={p.key}
              className={`ad-list-item ad-list-item--menu${editKey === p.key ? " is-on" : ""}`}
              onClick={() => setEditKey(p.key)}
            >
              <i className="ad-thumb-empty" />
              <div>
                <strong>{label.ru || label.en}</strong>
                <span>{label.en || label.ru}</span>
              </div>
            </div>
          );
        })}
      </aside>
      <div className="ad-editor">
        <MenuPageForm key={editKey} pageKey={editKey} />
      </div>
    </div>
  );
}

function MenuPageForm({ pageKey }: { pageKey: MenuPageKey }) {
  const data = useSite();
  const [lang, setLang] = useState<Locale>("en");
  const meta = MENU_PAGES.find((p) => p.key === pageKey)!;
  const raw = data.pages[pageKey] ?? { en: [], ru: [], label: meta.label };
  const blocks = alignPublicationBlocks({ en: raw.en ?? [], ru: raw.ru ?? [] }, "en");
  const label = pageLabel(data.pages, pageKey);

  const isCommission = pageKey === "commission";
  const mail = pageMail(data.pages);

  function patchPage(partial: {
    en?: ArticleBlock[];
    ru?: ArticleBlock[];
    label?: Localized;
    mail?: MailTemplate;
  }) {
    const savedMail = raw.mail ?? (isCommission ? mail : undefined);
    patchSite({
      pages: {
        ...data.pages,
        [pageKey]: {
          en: partial.en ?? blocks.en,
          ru: partial.ru ?? blocks.ru,
          label: partial.label ?? label,
          ...(partial.mail ?? savedMail ? { mail: partial.mail ?? savedMail } : {}),
        },
      },
    });
  }

  function patchBlocks(next: ArticleBlock[]) {
    const other = lang === "en" ? "ru" : "en";
    const mirrored = syncBlocks(blocks[lang], next, blocks[other], lang);
    patchPage(lang === "en" ? { en: next, ru: mirrored } : { ru: next, en: mirrored });
  }

  function patchTitle(value: string) {
    patchPage({ label: mirrorText(label, lang, value) });
  }

  function patchMail(key: keyof MailTemplate, value: string) {
    patchPage({ mail: { ...mail, [key]: mirrorText(mail[key], lang, value) } });
  }

  return (
    <div className="ad-form">
      <div className="ad-lang-row">
        <div className="ad-type">
          <button type="button" className={lang === "en" ? "is-on" : ""} onClick={() => setLang("en")}>
            Английская версия
          </button>
          <button type="button" className={lang === "ru" ? "is-on" : ""} onClick={() => setLang("ru")}>
            Русская версия
          </button>
        </div>
      </div>

      <Field label="Название кнопки">
        <TextInput value={label[lang]} onChange={(e) => patchTitle(e.target.value)} required />
      </Field>

      {isCommission ? (
        <div className="ad-article">
          <h3>Письмо · {lang === "en" ? "EN" : "RU"}</h3>
          <p className="ad-hint">
            Кнопка сразу открывает у посетителя окно нового письма на вашу почту с этой темой и текстом.
            Отдельной страницы у кнопки нет. Текст можно писать в несколько строк; текст русской версии
            копируется с английской, пока его не перевели.
          </p>
          <Field label="Тема письма">
            <TextInput value={mail.subject[lang]} onChange={(e) => patchMail("subject", e.target.value)} />
          </Field>
          <Field label="Текст письма">
            <TextArea
              rows={9}
              value={mail.body[lang]}
              onChange={(e) => patchMail("body", e.target.value)}
            />
          </Field>
        </div>
      ) : (
        <div className="ad-article">
          <h3>Редактор статьи · {lang === "en" ? "EN" : "RU"}</h3>
          <p className="ad-hint">
            Те же блоки, что у карточек. Структура, изображения и ссылки общие для обеих версий; текст копируется, пока его не перевели.
          </p>
          <BlockEditor blocks={blocks[lang]} onChange={patchBlocks} />
        </div>
      )}
    </div>
  );
}

