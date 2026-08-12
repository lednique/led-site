import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BlockEditor } from "../admin/BlockEditor";
import { Field, ImagePick, SvgPick, TextArea, TextInput } from "../admin/fields";
import { cardSurface, uid } from "../lib/color";
import { resolveSrc } from "../media";
import {
  patchSite,
  removePublication,
  resetSite,
  savePublication,
  sortedPublications,
  useSite,
} from "../store";
import type { NavItem, Publication, SocialItem } from "../types";

type Tab = "cards" | "banner" | "buttons";

export function AdminPage() {
  const data = useSite();
  const [tab, setTab] = useState<Tab>("cards");

  return (
    <div className="admin">
      <header className="ad-top">
        <div>
          <p className="ad-kicker">LEDNIQUE</p>
          <h1>Панель управления</h1>
        </div>
        <div className="ad-top-actions">
          <button type="button" className="ad-ghost" onClick={() => resetSite()}>
            Сбросить
          </button>
          <Link className="ad-btn" to="/">
            К сайту
          </Link>
        </div>
      </header>

      <nav className="ad-tabs">
        {(
          [
            ["cards", "Карточки"],
            ["banner", "Баннер"],
            ["buttons", "Кнопки"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "cards" && <CardsTab />}
      {tab === "banner" && (
        <section className="ad-grid">
          <ImagePick
            label="Изображение баннера"
            value={data.banner.image}
            onChange={(image) => patchSite({ banner: { ...data.banner, image } })}
          />
          <Field label="FaceShop / бренд">
            <TextInput
              value={data.banner.brand}
              onChange={(e) => patchSite({ banner: { ...data.banner, brand: e.target.value } })}
            />
          </Field>
          <Field label="3D FACE CHART COLLECTION">
            <TextArea
              rows={3}
              value={data.banner.title}
              onChange={(e) => patchSite({ banner: { ...data.banner, title: e.target.value } })}
            />
          </Field>
          <Field label="Подпись (click to learn more)">
            <TextInput
              value={data.banner.cta}
              onChange={(e) => patchSite({ banner: { ...data.banner, cta: e.target.value } })}
            />
          </Field>
          <Field label="Ссылка баннера">
            <TextInput
              value={data.banner.url}
              onChange={(e) => patchSite({ banner: { ...data.banner, url: e.target.value } })}
            />
          </Field>
        </section>
      )}
      {tab === "buttons" && <ButtonsTab />}
    </div>
  );
}

function CardsTab() {
  const data = useSite();
  const pubs = useMemo(() => sortedPublications(data), [data]);
  const [editId, setEditId] = useState<string | null>(pubs[0]?.id ?? null);
  const [draft, setDraft] = useState<Publication | null>(null);
  const current = draft ?? pubs.find((p) => p.id === editId) ?? null;

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
        {pubs.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`ad-list-item${editId === p.id && !draft ? " is-on" : ""}`}
            onClick={() => {
              setDraft(null);
              setEditId(p.id);
            }}
          >
            <img src={resolveSrc(p.image)} alt="" />
            <div>
              <strong>{p.title}</strong>
              <span>
                {p.type === "link" ? "Ссылка" : "Статья"} · {new Date(p.createdAt).toLocaleDateString("ru-RU")}
              </span>
            </div>
            <i style={cardSurface(p.color)} />
          </button>
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
  return {
    id: uid("pub"),
    createdAt: Date.now(),
    title: "Новая публикация",
    type: "article",
    color: "#FF089C",
    image: "builtin:magenta",
    url: "",
    blocks: [{ id: uid("b"), type: "heading", text: "Заголовок" }],
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
  const [pub, setPub] = useState<Publication>(initial);

  function patch(partial: Partial<Publication>) {
    setPub((p) => ({ ...p, ...partial }));
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
      <Field label="Заголовок карточки">
        <TextInput value={pub.title} onChange={(e) => patch({ title: e.target.value })} required />
      </Field>

      <div className="ad-type">
        <button type="button" className={pub.type === "article" ? "is-on" : ""} onClick={() => patch({ type: "article" })}>
          Статья
        </button>
        <button type="button" className={pub.type === "link" ? "is-on" : ""} onClick={() => patch({ type: "link" })}>
          Ссылка
        </button>
      </div>

      <Field label="Цвет карточки (режим Color)">
        <div className="ad-color">
          <input type="color" value={pub.color} onChange={(e) => patch({ color: e.target.value })} />
          <TextInput value={pub.color} onChange={(e) => patch({ color: e.target.value })} />
          <span className="ad-color-swatch" style={cardSurface(pub.color)} />
        </div>
      </Field>

      <ImagePick label="Изображение" value={pub.image} onChange={(image) => patch({ image })} />

      {pub.type === "link" && (
        <Field label="URL">
          <TextInput value={pub.url ?? ""} onChange={(e) => patch({ url: e.target.value })} placeholder="https://" />
        </Field>
      )}

      {pub.type === "article" && (
        <div className="ad-article">
          <h3>Редактор статьи</h3>
          <p className="ad-hint">Блоки с шагом 10 px. Текст — Markdown.</p>
          <BlockEditor blocks={pub.blocks} onChange={(blocks) => patch({ blocks })} />
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
            onClick={() => {
              if (confirm("Удалить публикацию?")) removePublication(pub.id);
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
          <div key={btn.id} className="ad-item-card">
            <SvgPick
              label="SVG иконка"
              value={btn.svg}
              onChange={(svg) => setNav(data.nav.map((b, n) => (n === i ? { ...b, svg } : b)))}
            />
            <Field label="Название">
              <TextInput
                value={btn.label}
                onChange={(e) => setNav(data.nav.map((b, n) => (n === i ? { ...b, label: e.target.value } : b)))}
              />
            </Field>
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
        ))}
        {data.nav.length < 4 && (
          <button
            type="button"
            className="ad-btn"
            onClick={() =>
              setNav([...data.nav, { id: uid("nav"), label: "Button", url: "https://", svg: "" }])
            }
          >
            + Кнопка
          </button>
        )}
      </section>

      <section>
        <h3>Social Networks · до 6 · сетка 2×3</h3>
        {data.socials.map((s, i) => (
          <div key={s.id} className="ad-item-card">
            <ImagePick
              label="Иконка / фото"
              value={s.image}
              onChange={(image) => setSocials(data.socials.map((x, n) => (n === i ? { ...x, image } : x)))}
            />
            <Field label="Название">
              <TextInput
                value={s.label}
                onChange={(e) => setSocials(data.socials.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)))}
              />
            </Field>
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
        ))}
        {data.socials.length < 6 && (
          <button
            type="button"
            className="ad-btn"
            onClick={() =>
              setSocials([...data.socials, { id: uid("soc"), label: "Social", url: "https://", image: "builtin:ig" }])
            }
          >
            + Ссылка
          </button>
        )}
      </section>
    </div>
  );
}
