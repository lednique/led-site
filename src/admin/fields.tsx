import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { inspectImage, OversizeImageError, readFileAsText, sanitizeSvg } from "../lib/files";
import { VideoDecodeError, videoToFrames, type FrameProgress } from "../lib/frames";
import {
  canFallbackToFrames,
  MEDIA_BUCKET_FIX_SQL,
  uploadMedia,
  uploadVideo,
  videoUploadProblem,
  type StorageProblem,
} from "../lib/upload";
import { resolveSrc } from "../media";

/** Явно перечисляем форматы: часть браузеров не подставляет GIF/APNG под image/*. */
const ACCEPT_IMAGE =
  "image/*,image/gif,image/apng,image/png,image/webp,image/jpeg,image/svg+xml,.gif,.apng,.png,.webp,.jpg,.jpeg,.svg,.ico";

/** Форматы видео, которые точно играют в браузерах: MP4 (H.264) и WebM. */
const ACCEPT_VIDEO = "video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.m4v,.webm,.ogv,.mov";

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
    // Пока идёт нарезка кадров, второй файл не берём: две очереди загрузок
    // перемешали бы превью и прогресс.
    if (!file || busy) return;
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

/** Что показывает панель, пока ролик превращается в кадры. */
function progressText(progress: FrameProgress): string {
  return `${progress.stage === "encode" ? "Нарезаю кадры" : "Загружаю кадры"}: ${progress.done} из ${progress.total}`;
}

/** «48 кадров», «2 кадра», «1 кадр» — подпись на превью последовательности. */
function framesLabel(count: number): string {
  const tens = count % 100;
  const ones = count % 10;
  const word = ones === 1 && tens !== 11 ? "кадр" : ones >= 2 && ones <= 4 && (tens < 12 || tens > 14) ? "кадра" : "кадров";
  return `${count} ${word}`;
}

/** Ответ панели на ошибку запасного пути: текст ролика или отказ Storage. */
function framesProblem(err: unknown): StorageProblem {
  if (err instanceof VideoDecodeError) return { text: err.message, kind: "other" };
  return videoUploadProblem(err);
}

/**
 * Сообщение под полем загрузки: отказ (`error`) или рассказ о том, что панель
 * сделала вместо запрошенного (`info`) — с запросом для Supabase, если он нужен.
 */
type Report = { tone: "error" | "info"; text: string; sql?: string };

/**
 * Загрузка видео для параллакс-блока статьи. Ролик уходит в Storage как есть,
 * без пережатия: браузер не умеет перекодировать видео. Превью показываем тем
 * же тегом <video>, каким блок отображается на сайте.
 *
 * Если корзина медиа отказалась принимать видеофайл, здесь же срабатывает
 * запасной путь: ролик нарезается на кадры и загружается картинками — блок на
 * сайте выглядит так же, разница только в отсутствии видеофайла.
 *
 * Отказ базы остаётся под полем вместе с запросом, который её чинит: alert
 * закрывается, а искать в Supabase настройки корзины владельцу сайта не нужно.
 */
export function VideoPick({
  label,
  value,
  frames,
  onChange,
  folder = "video",
  hint,
}: {
  label: string;
  /** Ссылка на видеофайл. Пустая, если блок хранит последовательность кадров. */
  value: string;
  /** Кадры вместо видеофайла. */
  frames?: string[];
  onChange: (value: { src: string; frames?: string[] }) => void;
  folder?: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [copied, setCopied] = useState(false);
  /** Что происходит прямо сейчас: нарезка кадров или их загрузка. */
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<FrameProgress | null>(null);

  const sequence = frames && frames.length ? frames : null;

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Пока идёт нарезка кадров, второй файл не берём: две очереди загрузок
    // перемешали бы превью и прогресс.
    if (!file || busy) return;
    setBusy(true);
    setReport(null);
    setCopied(false);
    setNotice("");
    setProgress(null);
    try {
      onChange({ src: await uploadVideo(file, folder), frames: undefined });
      return;
    } catch (err) {
      const failure = videoUploadProblem(err);
      // База не принимает именно видеофайлы — картинки она возьмёт, поэтому
      // пробуем запасной путь. Иначе чинить нужно саму базу.
      if (!canFallbackToFrames(failure)) {
        setReport({ tone: "error", ...failure });
        window.alert(failure.text);
        return;
      }
      setNotice("Supabase не принимает видеофайлы — делаю анимацию из кадров ролика.");
      try {
        const result = await videoToFrames(file, setProgress);
        onChange({ src: "", frames: result.frames });
        setReport({
          tone: "info",
          text:
            `База не принимает видеофайлы, поэтому ролик сохранён как анимация из ${result.frames.length} кадров: ` +
            `на сайте блок листается прокруткой точно так же, просто вместо одного файла — набор картинок. ` +
            `Чтобы снова грузить цельное видео, выполните запрос ниже в Supabase → SQL Editor.`,
          sql: MEDIA_BUCKET_FIX_SQL,
        });
      } catch (fallbackError) {
        const failure2 = framesProblem(fallbackError);
        setReport({ tone: "error", ...failure2 });
        window.alert(failure2.text);
      } finally {
        setNotice("");
        setProgress(null);
      }
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function copySql() {
    if (!report?.sql) return;
    try {
      await navigator.clipboard.writeText(report.sql);
      setCopied(true);
    } catch {
      // Буфер обмена бывает закрыт (http, старый браузер) — запрос всё равно
      // виден целиком, его можно выделить и скопировать руками.
      setCopied(false);
    }
  }

  return (
    <div className="ad-field ad-image-field ad-image-field--wide">
      <span>{label}</span>
      <div className={`ad-upload ad-upload--video${value || sequence ? " has-img" : ""}${busy ? " is-busy" : ""}`}>
        {sequence ? (
          <img src={resolveSrc(sequence[0])} alt="" />
        ) : value ? (
          <video src={resolveSrc(value)} muted playsInline preload="metadata" controls={false} />
        ) : (
          <i className="ad-upload-empty" />
        )}
        {sequence ? <b className="ad-anim-badge">{framesLabel(sequence.length)}</b> : null}
        <input type="file" accept={ACCEPT_VIDEO} disabled={busy} onChange={onFile} />
      </div>
      {hint ? <p className="ad-hint">{hint}</p> : null}
      {notice ? (
        <p className="ad-hint ad-upload-progress">
          {notice} {progress ? progressText(progress) : "Читаю ролик…"}
        </p>
      ) : null}
      {report ? (
        <div className={`ad-upload-report${report.tone === "error" ? " is-error" : ""}`}>
          <p>{report.text}</p>
          {report.sql ? (
            <>
              <pre>{report.sql}</pre>
              <button type="button" className="ad-ghost ad-copy-sql" onClick={copySql}>
                {copied ? "Скопировано" : "Скопировать запрос"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {value || sequence ? (
        <button
          type="button"
          className="ad-ghost ad-clear-img"
          onClick={() => {
            setReport(null);
            onChange({ src: "", frames: undefined });
          }}
        >
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
