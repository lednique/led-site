import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { resolveSrc } from "../media";
import { scrollParent, viewportBox } from "../lib/scroll";
import { useArticleMedia } from "./ArticleMedia";

type ParallaxVideoProps = {
  /** Идентификатор блока — им блок отмечается в «шлюзе» готовности статьи. */
  id: string;
  /** Ссылка на видеофайл. */
  src: string;
  /**
   * Последовательность кадров вместо видеофайла — её панель делает из ролика,
   * когда Storage не принимает видео. Кадры привязаны к прокрутке так же.
   */
  frames?: string[];
};

/** Сколько максимум ждём первый кадр, прежде чем показать блок как есть. */
const FIRST_FRAME_TIMEOUT = 8000;

/**
 * Параллакс-блок: кадр привязан к прокрутке статьи.
 *
 * Ничего не проигрывается само — позиция блока в окне просмотра пересчитывается
 * в номер кадра. Первый кадр стоит, пока блок только входит снизу; последний —
 * в тот момент, когда нижняя граница блока уходит за верхнюю границу статьи.
 * Плеера, кнопок и звука нет.
 *
 * Источник кадра может быть двояким: видеофайл (перемотка `currentTime`) или
 * нарезанная панелью последовательность картинок (рисуем в canvas). Прокрутка
 * и «шлюз» готовности статьи у них общие.
 */
export function ParallaxVideo({ id, src, frames }: ParallaxVideoProps) {
  // Видеофайл легче и качественнее, поэтому кадры — только когда файла нет.
  const sequence = !src && frames && frames.length ? frames : null;
  if (sequence) return <ParallaxFrames id={id} frames={sequence} />;
  return <ParallaxClip id={id} src={src} />;
}

/**
 * Сообщает читалке о готовности ровно один раз: пока все тяжёлые блоки статьи
 * не загрузились, поверх неё висит экран загрузки.
 */
function useBlockReady(id: string, ready: boolean) {
  const gate = useArticleMedia();
  const markReady = gate?.markReady;
  useEffect(() => {
    if (!ready) return;
    markReady?.(id);
  }, [id, ready, markReady]);
}

/** Страховка от «вечной» загрузки на медленной сети. */
function useFrameTimeout(waiting: boolean): boolean {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    setTimedOut(false);
    if (!waiting) return;
    const timer = window.setTimeout(() => setTimedOut(true), FIRST_FRAME_TIMEOUT);
    return () => window.clearTimeout(timer);
  }, [waiting]);
  return timedOut;
}

/**
 * Прогресс блока в окне просмотра: 0 — верх блока на нижней границе окна,
 * 1 — низ блока за верхней границей статьи.
 *
 * Ради плавности пересчёт идёт в rAF-кадре и только когда значение действительно
 * изменилось: лишний вызов дешевле пропущенного кадра, но дороже сотни одинаковых.
 */
function useScrollProgress(holderRef: RefObject<HTMLDivElement | null>, onProgress: (progress: number) => void) {
  const handler = useRef(onProgress);
  useEffect(() => {
    handler.current = onProgress;
  });

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const scroller = scrollParent(holder);
    let frame = 0;
    let last = -1;

    const apply = () => {
      frame = 0;
      const box = holder.getBoundingClientRect();
      const view = viewportBox(scroller);
      // Путь блока: от «верх блока на нижней границе окна» до «низ блока за
      // верхней границей окна».
      const distance = view.height + box.height;
      const travelled = view.top + view.height - box.top;
      const progress = distance > 0 ? Math.min(1, Math.max(0, travelled / distance)) : 0;
      if (last >= 0 && Math.abs(progress - last) < 0.0005) return;
      last = progress;
      handler.current(progress);
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    const targets: (HTMLElement | Window)[] = scroller ? [scroller, window] : [window];
    targets.forEach((node) => node.addEventListener("scroll", schedule, { passive: true }));
    window.addEventListener("resize", schedule);
    schedule();

    return () => {
      targets.forEach((node) => node.removeEventListener("scroll", schedule));
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [holderRef]);
}

function holderStyle(ratio: number): CSSProperties | undefined {
  // Пропорции кадра берём из самого файла: на мобильной блок показывается
  // целиком от края до края, поэтому его высота должна совпадать с кадром.
  return ratio ? ({ "--video-ratio": String(ratio) } as CSSProperties) : undefined;
}

/* ——— видеофайл ——— */

function ParallaxClip({ id, src }: { id: string; src: string }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [ratio, setRatio] = useState(0);
  const timedOut = useFrameTimeout(Boolean(src));
  useBlockReady(id, ready || timedOut || !src);

  const progressRef = useRef(0);
  /** Кадр, который должен стоять сейчас; -1 — ещё ничего не считали. */
  const wantedRef = useRef(-1);
  /** Кадр, который уже отдан браузеру. */
  const appliedRef = useRef(-1);

  useEffect(() => {
    wantedRef.current = -1;
    appliedRef.current = -1;
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const read = () => {
      if (video.videoWidth && video.videoHeight) setRatio(video.videoWidth / video.videoHeight);
    };
    read();
    video.addEventListener("loadedmetadata", read);
    return () => video.removeEventListener("loadedmetadata", read);
  }, [src]);

  // Ошибка не должна держать статью закрытой — показываем её без ролика.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    const finish = () => setReady(true);
    // readyState ≥ 2 (HAVE_CURRENT_DATA) значит, что первый кадр уже есть.
    if (video.readyState >= 2) finish();
    video.addEventListener("loadeddata", finish);
    video.addEventListener("canplay", finish);
    video.addEventListener("error", finish);
    return () => {
      video.removeEventListener("loadeddata", finish);
      video.removeEventListener("canplay", finish);
      video.removeEventListener("error", finish);
    };
  }, [src]);

  const seek = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // Пока идёт предыдущая перемотка, новую не начинаем: на мобильных WebKit
    // очередь seek'ов превращается в рывки. Нужный кадр останется в `wantedRef`
    // и доедет по событию seeked.
    if (wantedRef.current < 0 || video.seeking || video.readyState < 1) return;
    if (Math.abs(wantedRef.current - appliedRef.current) < 0.01) return;
    appliedRef.current = wantedRef.current;
    try {
      video.currentTime = wantedRef.current;
    } catch {
      /* перемотка до готовности метаданных — просто пропускаем кадр */
    }
  }, []);

  const applyProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const duration = video.duration;
    if (!duration || !Number.isFinite(duration)) return;
    // Последний кадр не ставим ровно в duration: часть браузеров на этом
    // месте показывает пустоту вместо кадра.
    wantedRef.current = Math.min(duration - 0.05, progressRef.current * duration);
    seek();
  }, [seek]);

  useScrollProgress(holderRef, (progress) => {
    progressRef.current = progress;
    applyProgress();
  });

  // Метаданные дают длительность, seeked — возможность догнать кадр,
  // который накопился, пока шла предыдущая перемотка.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    video.addEventListener("loadedmetadata", applyProgress);
    video.addEventListener("seeked", seek);
    return () => {
      video.removeEventListener("loadedmetadata", applyProgress);
      video.removeEventListener("seeked", seek);
    };
  }, [src, applyProgress, seek]);

  return (
    <div ref={holderRef} className={`block-video${ready || timedOut || !src ? " is-ready" : ""}`} style={holderStyle(ratio)}>
      <video
        ref={videoRef}
        src={resolveSrc(src)}
        muted
        playsInline
        // Ролик не играет сам — им управляет прокрутка, поэтому ни autoPlay,
        // ни controls, ни loop тут не нужны. preload="auto" обязателен:
        // без буфера перемотка идёт рывками.
        preload="auto"
        disablePictureInPicture
        controls={false}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

/* ——— последовательность кадров ——— */

function ParallaxFrames({ id, frames }: { id: string; frames: string[] }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const drawnRef = useRef(-1);
  const progressRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [ratio, setRatio] = useState(0);
  const timedOut = useFrameTimeout(true);
  useBlockReady(id, ready || timedOut);
  // Состав кадров меняется вместе со списком ссылок: по нему и пересобираемся.
  const key = frames.join("|");

  const draw = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const image = imagesRef.current[index];
    // Кадр ещё в пути — оставляем предыдущий, пустое место не показываем.
    if (!canvas || !image || !image.complete || !image.naturalWidth || drawnRef.current === index) return;
    if (canvas.width !== image.naturalWidth || canvas.height !== image.naturalHeight) {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    drawnRef.current = index;
  }, []);

  /** Кадр под текущую прокрутку: первый — до начала, последний — в конце пути. */
  const sync = useCallback(() => {
    const total = imagesRef.current.length;
    if (!total) return;
    draw(Math.min(total - 1, Math.max(0, Math.round(progressRef.current * (total - 1)))));
  }, [draw]);

  useScrollProgress(holderRef, (progress) => {
    progressRef.current = progress;
    sync();
  });

  useEffect(() => {
    let alive = true;
    drawnRef.current = -1;
    // Кадры грузятся все сразу и в любом порядке: блок небольшой, а показывать
    // его нужно с первого же кадра, досылка остальных идёт в фоне.
    imagesRef.current = frames.map((frame) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (!alive) return;
        if (image.naturalWidth && image.naturalHeight) setRatio(image.naturalWidth / image.naturalHeight);
        setReady(true);
        sync();
      };
      image.src = resolveSrc(frame);
      return image;
    });
    return () => {
      alive = false;
      imagesRef.current = [];
    };
  }, [key, sync]);

  return (
    <div ref={holderRef} className={`block-video${ready || timedOut ? " is-ready" : ""}`} style={holderStyle(ratio)}>
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
