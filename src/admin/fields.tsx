import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { readFileAsText, sanitizeSvg } from "../lib/files";
import { uploadMedia } from "../lib/upload";
import { resolveSrc } from "../media";

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
  mime,
  clearable,
}: {
  label: string;
  value: string;
  onChange: (src: string) => void;
  variant?: "wide" | "tall" | "icon";
  folder?: string;
  maxSize?: number;
  mime?: string;
  clearable?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadMedia(file, folder, { max: maxSize, mime }));
    } catch {
      window.alert("Не удалось загрузить изображение");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className={`ad-field ad-image-field ad-image-field--${variant}`}>
      <span>{label}</span>
      <div className={`ad-upload ad-upload--${variant}${value ? " has-img" : ""}${busy ? " is-busy" : ""}`}>
        {value ? <img src={resolveSrc(value)} alt="" /> : <i className="ad-upload-empty" />}
        <input type="file" accept="image/*,.ico,.svg" onChange={onFile} />
      </div>
      {clearable && value ? (
        <button type="button" className="ad-ghost ad-clear-img" onClick={() => onChange("")}>
          Сбросить
        </button>
      ) : null}
    </div>
  );
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
