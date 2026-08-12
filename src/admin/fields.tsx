import type { ChangeEvent } from "react";
import { compressImage, readFileAsText, sanitizeSvg } from "../lib/files";
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
}: {
  label: string;
  value: string;
  onChange: (src: string) => void;
}) {
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange(await compressImage(file));
    e.target.value = "";
  }

  return (
    <div className="ad-field">
      <span>{label}</span>
      <div className="ad-upload">
        {value && <img src={resolveSrc(value)} alt="" />}
        <input type="file" accept="image/*" onChange={onFile} />
      </div>
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
    <div className="ad-field">
      <span>{label}</span>
      <div className="ad-upload ad-upload--svg">
        <span className="ad-svg-preview" dangerouslySetInnerHTML={{ __html: value }} />
        <input type="file" accept=".svg,image/svg+xml" onChange={onFile} />
      </div>
    </div>
  );
}
