import { MarkdownView } from "../lib/markdown";
import { uid } from "../lib/color";
import type { ArticleBlock } from "../types";
import { Field, ImagePick, TextArea, TextInput } from "./fields";

type BlockEditorProps = {
  blocks: ArticleBlock[];
  onChange: (blocks: ArticleBlock[]) => void;
};

export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  function update(id: string, patch: Partial<ArticleBlock>) {
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as ArticleBlock) : b)));
  }

  function move(id: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    onChange(next);
  }

  function add(type: ArticleBlock["type"]) {
    const id = uid("b");
    const block: ArticleBlock =
      type === "heading"
        ? { id, type, text: "Заголовок" }
        : type === "text"
          ? { id, type, markdown: "**Текст** статьи" }
          : type === "image"
            ? { id, type, src: "", alt: "" }
            : type === "link"
              ? { id, type, label: "Открыть", url: "https://", style: "solid" }
              : { id, type };
    onChange([...blocks, block]);
  }

  return (
    <div className="ad-blocks">
      <div className="ad-block-add">
        <button type="button" onClick={() => add("heading")}>
          + Заголовок
        </button>
        <button type="button" onClick={() => add("text")}>
          + Текст
        </button>
        <button type="button" onClick={() => add("image")}>
          + Изображение
        </button>
        <button type="button" onClick={() => add("link")}>
          + Кнопка-ссылка
        </button>
        <button type="button" onClick={() => add("form")}>
          + Форма
        </button>
      </div>

      {blocks.map((block, index) => (
        <div key={block.id} className="ad-block">
          <div className="ad-block-bar">
            <strong>
              {block.type === "heading"
                ? "Заголовок"
                : block.type === "text"
                  ? "Текст"
                  : block.type === "image"
                    ? "Изображение"
                    : block.type === "link"
                      ? "Кнопка-ссылка"
                      : "Форма"}
            </strong>
            <div className="ad-block-actions">
              <button type="button" disabled={index === 0} onClick={() => move(block.id, -1)}>
                ↑
              </button>
              <button type="button" disabled={index === blocks.length - 1} onClick={() => move(block.id, 1)}>
                ↓
              </button>
              <button type="button" onClick={() => onChange(blocks.filter((b) => b.id !== block.id))}>
                ✕
              </button>
            </div>
          </div>

          {block.type === "heading" && (
            <Field label="Заголовок">
              <TextInput value={block.text} onChange={(e) => update(block.id, { text: e.target.value })} />
            </Field>
          )}

          {block.type === "text" && (
            <div className="ad-md">
              <div className="ad-md-tools">
                <MdBtn
                  label="B"
                  title="Жирный"
                  onClick={() => update(block.id, { markdown: wrap(block.markdown, "**") })}
                />
                <MdBtn
                  label="I"
                  title="Курсив"
                  onClick={() => update(block.id, { markdown: wrap(block.markdown, "*") })}
                />
                <MdBtn
                  label="H2"
                  title="Заголовок"
                  onClick={() => update(block.id, { markdown: `${block.markdown}\n\n## ` })}
                />
                <MdBtn
                  label="•"
                  title="Список"
                  onClick={() => update(block.id, { markdown: `${block.markdown}\n- ` })}
                />
                <MdBtn
                  label="Link"
                  title="Ссылка"
                  onClick={() => update(block.id, { markdown: `${block.markdown}[текст](https://)` })}
                />
              </div>
              <TextArea
                rows={7}
                value={block.markdown}
                onChange={(e) => update(block.id, { markdown: e.target.value })}
              />
              <div className="ad-md-preview">
                <MarkdownView source={block.markdown} />
              </div>
            </div>
          )}

          {block.type === "image" && (
            <>
              <ImagePick label="Файл" folder="article" value={block.src} onChange={(src) => update(block.id, { src })} />
              <Field label="Alt">
                <TextInput value={block.alt} onChange={(e) => update(block.id, { alt: e.target.value })} />
              </Field>
            </>
          )}

          {block.type === "link" && (
            <div className="ad-link-block">
              <Field label="Текст кнопки">
                <TextInput
                  value={block.label}
                  onChange={(e) => update(block.id, { label: e.target.value })}
                  placeholder="Открыть"
                />
              </Field>
              <Field label="Ссылка">
                <TextInput
                  value={block.url}
                  onChange={(e) => update(block.id, { url: e.target.value })}
                  placeholder="https://"
                />
              </Field>
              <Field label="Вид">
                <div className="ad-type">
                  <button
                    type="button"
                    className={(block.style ?? "solid") === "solid" ? "is-on" : ""}
                    onClick={() => update(block.id, { style: "solid" })}
                  >
                    Заливка
                  </button>
                  <button
                    type="button"
                    className={block.style === "ghost" ? "is-on" : ""}
                    onClick={() => update(block.id, { style: "ghost" })}
                  >
                    Контур
                  </button>
                </div>
              </Field>
              <div className="ad-link-preview">
                <span className={`article-link article-link--${block.style ?? "solid"}`}>
                  {block.label || "Открыть"}
                  <LinkGlyph />
                </span>
              </div>
            </div>
          )}

          {block.type === "form" && <p className="ad-hint">Контактная форма: имя, почта, сообщение.</p>}
        </div>
      ))}
    </div>
  );
}

function wrap(src: string, token: string): string {
  return `${src}${token}текст${token}`;
}

function LinkGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M5 2.5h6.5V9M11.2 2.8 2.5 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MdBtn({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button type="button" className="ad-md-btn" title={title} onClick={onClick}>
      {label}
    </button>
  );
}
