import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { resolveSrc } from "../media";
import { scrollOffset, scrollParent, viewportBox } from "../lib/scroll";
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

/** Сколько максимум ждём медиа (ролик или всю нарезку кадров), прежде чем показать блок как есть. */
const MEDIA_TIMEOUT = 10000;

/** Сколько кадров последовательности грузим одновременно: по порядку, но не по одному. */
const FRAME_CONCURRENCY = 4;

/**
 * Параллакс-блок: кадр привязан к прокрутке статьи.
 *
 * Ничего не проигрывается само — позиция блока в окне просмотра пересчитывается
 * в номер кадра. Первый кадр стоит, пока статья только открыта и читалка не
 * прокручена; последний — когда блок целиком ушёл за верхнюю границу окна
 * просмотра. Плеера, кнопок и звука нет.
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
    const timer = window.setTimeout(() => setTimedOut(true), MEDIA_TIMEOUT);
    return () => window.clearTimeout(timer);
  }, [waiting]);
  return timedOut;
}

/**
 * Прогресс блока: 0 — статья только открыта (читалка не прокручена, блок стоит
 * на своём месте), 1 — блок полностью ушёл за верхнюю границу окна просмотра
 * (его нижний край на верхней границе).
 *
 * Кадр двигается только вместе с прокруткой и только на этом отрезке: открыли
 * статью — стоит первый кадр, блок целиком уехал вверх — последний. Нулём
 * больше не служит нижняя граница экрана — раньше из-за неё статья открывалась
 * уже на середине анимации, а не с первого кадра.
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
    /** Путь блока от своего места при открытии статьи до верхней границы окна. */
    let rest = -1;

    const apply = () => {
      frame = 0;
      const box = holder.getBoundingClientRect();
      const view = viewportBox(scroller);
      const scrolled = scrollOffset(scroller);
      // Сколько осталось верху блока до верхней границы окна прямо сейчас.
      const gap = box.top - view.top;
      // Тот же путь без прокрутки: сколько нужно пролистать, чтобы верх блока
      // дошёл до верха окна. Отсчёт от места блока, а не от нижнего края экрана.
      const atRest = gap + scrolled;
      // Пока читалка наверху, точку отсчёта уточняем: блоки выше могут поменять
      // высоту (картинки, шрифты) и сдвинуть наш блок.
      if (rest < 0 || scrolled <= 0) rest = atRest;
      // Путь кадра заканчивается, когда блок ушёл за верх окна целиком, —
      // поэтому к расстоянию до верха окна добавляем высоту самого блока.
      const path = rest + box.height;
      const travelled = rest - gap;
      // path <= 0 значит, что блок уже целиком выше окна — анимация пройдена.
      const progress = path > 0 ? Math.min(1, Math.max(0, travelled / path)) : 1;
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
  if (!ratio) return undefined;
  // Пропорции кадра берём из самого файла: по ним блок считает свой размер,
  // а медиа заполняет блок целиком (fill) — без полей и без обрезки, потому
  // что пропорции блока и кадра совпадают.
  return {
    "--video-ratio": String(ratio),
    "--video-fit": "fill",
  } as CSSProperties;
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
    setReady(false);

    const total = frames.length;
    const images: HTMLImageElement[] = new Array(total);
    imagesRef.current = images;
    let next = 0;
    let done = 0;

    /**
     * Один кадр последовательности. Грузим по порядку — от первого к последнему:
     * начало анимации должно быть на месте раньше конца. Ошибка кадра тоже
     * завершает его загрузку, иначе один битый файл держал бы статью закрытой.
     */
    const load = (index: number): Promise<void> =>
      new Promise((resolve) => {
        const image = new Image();
        image.decoding = "async";
        images[index] = image;
        image.addEventListener("load", () => {
          if (!alive) {
            resolve();
            return;
          }
          // Пропорции берём из первого кадра: по ним блок считает свой размер.
          if (index === 0 && image.naturalWidth && image.naturalHeight) {
            setRatio(image.naturalWidth / image.naturalHeight);
          }
          // Кадр приехал — сразу ставим его на место, если прокрутка уже здесь.
          // Статья открывается первым кадром, поэтому он рисуется первым же.
          sync();
          resolve();
        });
        image.addEventListener("error", () => resolve());
        image.src = resolveSrc(frames[index]);
      });

    async function worker(): Promise<void> {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= total || !alive) return;
        await load(index);
        if (!alive) return;
        done += 1;
        // Готовность — это вся последовательность целиком, от первого кадра до
        // последнего: читалка открывается только тогда, поэтому прокрутка не
        // упирается в ещё не загруженные кадры.
        if (done >= total) {
          setReady(true);
          sync();
        }
      }
    }

    void Promise.all(
      Array.from({ length: Math.min(FRAME_CONCURRENCY, Math.max(1, total)) }, () => worker()),
    );

    return () => {
      alive = false;
      // Недогруженные кадры после закрытия статьи не нужны — снимаем их с загрузки.
      images.forEach((image) => {
        if (image && !image.complete) image.removeAttribute("src");
      });
      imagesRef.current = [];
    };
  }, [key, sync]);

  return (
    <div ref={holderRef} className={`block-video${ready || timedOut ? " is-ready" : ""}`} style={holderStyle(ratio)}>
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
