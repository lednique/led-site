import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { inspectImage, OversizeImageError, readFileAsText, sanitizeSvg } from "../lib/files";
import { uploadMedia } from "../lib/upload";
import { resolveSrc } from "../media";

/** Явно перечисляем форматы: часть браузеров не подставляет GIF/APNG под image/*. */
const ACCEPT_IMAGE =
  "image/*,image/gif,image/apng,image/png,image/webp,image/jpeg,image/svg+xml,.gif,.apng,.png,.webp,.jpg,.jpeg,.svg,.ico";

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

export function Field({ label, children }: FieldProps) {
  return (
    <label className="ad-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="ad-input" {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="ad-input ad-area" {...props} />;
}

export function ImagePick({
  label,
  value,
  onChange,
  variant = "wide",
  folder = "images",
  maxSize,
  maxWidth,
  maxBytes,
  keepDimensions,
  mime,
  clearable,
  hint,
}: {
  label: string;
  value: string;
  onChange: (src: string) => void;
  variant?: "wide" | "tall" | "icon";
  folder?: string;
  /** Ограничение по длинной стороне, px. По умолчанию 1600 (см. DEFAULT_POLICY). */
  maxSize?: number;
  /** Ограничение по ширине, px — картинки в статье. Меньше не растягиваем. */
  maxWidth?: number;
  /** Лимит веса файла, байты. Сверх лимита файл дожимается по качеству. */
  maxBytes?: number;
  /** Не менять разрешение файла (главный баннер). */
  keepDimensions?: boolean;
  mime?: string;
  clearable?: boolean;
  /** Подпись под полем: что панель сделает с загруженным файлом. */
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<string>("");

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const info = await inspectImage(file);
      setKind(info.animated ? info.ext.toUpperCase() : "");
      onChange(
        await uploadMedia(file, folder, {
          maxSide: maxSize,
          maxWidth,
          maxBytes,
          keepDimensions,
          mime,
        }),
      );
    } catch (err) {
      // Про лимит веса говорим прямо: файл можно только уменьшить вручную.
      window.alert(err instanceof OversizeImageError ? err.message : "Не удалось загрузить изображение");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  const animated = kind || animatedBadge(value);

  return (
    <div className={`ad-field ad-image-field ad-image-field--${variant}`}>
      <span>{label}</span>
      <div className={`ad-upload ad-upload--${variant}${value ? " has-img" : ""}${busy ? " is-busy" : ""}`}>
        {value ? <img src={resolveSrc(value)} alt="" /> : <i className="ad-upload-empty" />}
        {animated ? <b className="ad-anim-badge">{animated}</b> : null}
        <input type="file" accept={ACCEPT_IMAGE} onChange={onFile} />
      </div>
      {hint ? <p className="ad-hint">{hint}</p> : null}
      {clearable && value ? (
        <button type="button" className="ad-ghost ad-clear-img" onClick={() => onChange("")}>
          Сбросить
        </button>
      ) : null}
    </div>
  );
}

/** Определяет анимированный формат по уже сохранённой ссылке. */
function animatedBadge(src: string): string {
  if (!src) return "";
  if (/\.gif(\?|$)/i.test(src) || src.startsWith("data:image/gif")) return "GIF";
  if (/\.apng(\?|$)/i.test(src) || src.startsWith("data:image/apng")) return "APNG";
  return "";
}

export function SvgPick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (svg: string) => void;
}) {
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange(sanitizeSvg(await readFileAsText(file)));
    e.target.value = "";
  }

  return (
    <div className="ad-field ad-image-field ad-image-field--icon">
      <span>{label}</span>
      <div className="ad-upload ad-upload--svg ad-upload--icon">
        <span className="ad-svg-preview" dangerouslySetInnerHTML={{ __html: value }} />
        <input type="file" accept=".svg,image/svg+xml" onChange={onFile} />
      </div>
    </div>
  );
}

export function HashtagField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const tag = raw.trim().replace(/^#/, "");
    if (!tag || value.includes(tag)) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add(draft);
    }
  }

  return (
    <div className="ad-field">
      <span>Хештеги</span>
      <div className="ad-tags">
        {value.map((tag) => (
          <button key={tag} type="button" className="ad-tag" onClick={() => onChange(value.filter((t) => t !== tag))}>
            #{tag}
          </button>
        ))}
        <input
          className="ad-input ad-tag-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder="Enter"
        />
      </div>
    </div>
  );
}
