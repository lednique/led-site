import { uploadFrameSequence } from "./upload";

/**
 * Последовательность кадров из видеофайла.
 *
 * Параллакс-блок не проигрывает ролик — он ставит кадр по позиции прокрутки,
 * поэтому видеофайл здесь нужен только как источник кадров. Ролик режется
 * на кадры прямо в браузере: `<video>` перематывается по длительности, каждый
 * кадр рисуется в canvas и кодируется в картинку. Картинки корзина берёт
 * всегда, а звук в таком блоке и не использовался.
 *
 * APNG или анимированный WebP для этого не годятся: браузер проигрывает их
 * сам и не даёт поставить конкретный кадр, то есть привязать анимацию
 * к прокрутке нельзя. Отдельные кадры — можно.
 */

/** Максимальная ширина кадра, px. Больше сайт не показывает, а вес и память важнее. */
const FRAME_MAX_WIDTH = 1080;

/** Сколько кадров снимаем с секунды ролика: чаще — плавнее, но тяжелее. */
const FRAME_FPS = 12;

/**
 * Меньше — анимация станет «слайдами», больше — не нужно по плавности: кадр
 * меняется примерно каждые 30 px прокрутки, а весит последовательность как
 * пара фотографий статьи.
 */
const FRAME_MIN = 12;
const FRAME_MAX = 60;

/**
 * Бюджет памяти на сайте: кадры держатся декодированными, а это 4 байта на
 * пиксель. 48 Мпикс ≈ 190 МБ — потолок, при котором телефон не начинает
 * выгружать вкладки.
 */
const FRAME_PIXEL_BUDGET = 48_000_000;

/** Качество кадра (JPEG): соседние кадры похожи, а движение скрывает огрехи сжатия. */
const FRAME_QUALITY = 0.7;

const METADATA_TIMEOUT = 20_000;
const SEEK_TIMEOUT = 8_000;

/** Куда положили кадры в корзине media. */
export const FRAMES_FOLDER = "frames";

export type FrameStage = "encode" | "upload";

export type FrameProgress = { stage: FrameStage; done: number; total: number };

/** Ролик не разобрался в браузере: неподдерживаемый кодек, битый файл, таймаут. */
export class VideoDecodeError extends Error {
  constructor(reason: string) {
    super(
      `Не удалось нарезать ролик на кадры: ${reason}. ` +
        `Пересохраните видео в MP4 (H.264) или WebM и загрузите снова.`,
    );
    this.name = "VideoDecodeError";
  }
}

/** Кадр анимации браузера: за это время элемент успевает отрисоваться. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    // В фоновой вкладке rAF не наступает вовсе — не даём нарезке зависнуть.
    window.setTimeout(finish, 120);
  });
}

/**
 * Размер кадра в последовательности. Меньше исходного видео — сайт всё равно
 * не показывает блок крупнее, а вес и память телефона важнее. Ширину
 * ограничиваем, высота подстраивается под пропорции кадра.
 */
function outputSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, FRAME_MAX_WIDTH / width);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Сколько кадров делать: по длительности ролика, но в пределах памяти сайта. */
function frameCount(duration: number, out: { width: number; height: number }): number {
  const byDuration = Math.round(duration * FRAME_FPS) || FRAME_MIN;
  const byMemory = Math.max(FRAME_MIN, Math.floor(FRAME_PIXEL_BUDGET / Math.max(1, out.width * out.height)));
  return Math.max(FRAME_MIN, Math.min(FRAME_MAX, byDuration, byMemory));
}

/**
 * `<video>` на время нарезки добавляется в документ: на iOS Safari перемотка
 * элемента, которого нет на странице, может не сработать вовсе.
 */
function attachVideo(url: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.tabIndex = -1;
  video.setAttribute("aria-hidden", "true");
  // За экраном, но не display:none — иначе браузер не декодирует кадры.
  video.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  video.src = url;
  document.body.appendChild(video);
  return video;
}

/**
 * Ждём, пока браузер декодирует текущий кадр: при readyState < 2
 * (HAVE_CURRENT_DATA) drawImage рисует пустоту вместо изображения.
 */
function whenDecoded(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (error: Error | null) => {
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", ok);
      video.removeEventListener("canplay", ok);
      video.removeEventListener("error", failed);
      if (error) reject(error);
      else resolve();
    };
    const ok = () => finish(video.readyState >= 2 ? null : new VideoDecodeError("кадр не декодировался"));
    const failed = () => finish(new VideoDecodeError("браузер не читает этот файл"));
    const timer = window.setTimeout(() => finish(new VideoDecodeError("кадр не декодировался")), SEEK_TIMEOUT);
    video.addEventListener("loadeddata", ok);
    video.addEventListener("canplay", ok);
    video.addEventListener("error", failed);
  });
}

/**
 * Пробуем запустить ролик и тут же ставим на паузу: на iOS это самый надёжный
 * способ получить декодированный кадр для canvas. Где проигрывание запрещено —
 * ничего не ломается, продолжаем как есть.
 */
async function kickDecoder(video: HTMLVideoElement): Promise<void> {
  try {
    await video.play();
    video.pause();
  } catch {
    /* без жеста пользователя браузер вправе отказать */
  }
}

function whenMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error: Error | null) => {
      window.clearTimeout(timer);
      video.removeEventListener("loadedmetadata", ok);
      video.removeEventListener("error", failed);
      if (error) reject(error);
      else resolve();
    };
    const ok = () => finish(null);
    const failed = () => finish(new VideoDecodeError("браузер не читает этот файл"));
    const timer = window.setTimeout(() => finish(new VideoDecodeError("ролик не открылся за отведённое время")), METADATA_TIMEOUT);
    video.addEventListener("loadedmetadata", ok);
    video.addEventListener("error", failed);
  });
}

/** Ставит видео на нужное время и ждёт, пока кадр действительно появится. */
async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.max(0, time);
  // Время уже стоит: событие seeked в этом случае не приходит вовсе.
  if (Math.abs(video.currentTime - target) < 1 / 480) {
    await whenDecoded(video);
    await nextPaint();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const finish = (error: Error | null) => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", ok);
      video.removeEventListener("error", failed);
      if (error) reject(error);
      else resolve();
    };
    const ok = () => finish(null);
    const failed = () => finish(new VideoDecodeError("файл читается с ошибкой"));
    const timer = window.setTimeout(() => finish(new VideoDecodeError("кадр не перемотался")), SEEK_TIMEOUT);
    video.addEventListener("seeked", ok);
    video.addEventListener("error", failed);
    try {
      video.currentTime = target;
    } catch {
      finish(new VideoDecodeError("ролик не перематывается"));
    }
  });
  // После перемотки readyState может упасть до метаданных: ждём новый кадр.
  await whenDecoded(video);
  await nextPaint();
}

/**
 * Длительность ролика. У WebM, записанного в браузере, в заголовке бывает
 * бесконечность — тогда её узнают, дойдя до конца файла.
 */
async function readDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  try {
    await seekTo(video, Number.MAX_SAFE_INTEGER);
    const end = video.currentTime;
    await seekTo(video, 0);
    if (Number.isFinite(end) && end > 0) return end;
  } catch {
    // Ниже — общая ошибка: без длительности кадры не нарезать.
  }
  throw new VideoDecodeError("не удалось узнать длительность");
}

/** Кодирует canvas в JPEG: кадры фотореалистичны, JPEG жмёт их заметно легче. */
function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (jpeg) => (jpeg ? resolve(jpeg) : reject(new VideoDecodeError("кадр не сохранился"))),
      "image/jpeg",
      FRAME_QUALITY,
    );
  });
}

/**
 * Режет файл на кадры. Возвращает готовые к загрузке картинки и пропорции
 * кадра — по ним блок задаёт свою высоту.
 */
export async function extractVideoFrames(
  file: File,
  onProgress?: (progress: FrameProgress) => void,
): Promise<{ blobs: Blob[]; ratio: number }> {
  const url = URL.createObjectURL(file);
  const video = attachVideo(url);
  try {
    await whenMetadata(video);
    // До первого декодированного кадра drawImage рисует пустоту.
    await kickDecoder(video);
    await whenDecoded(video);
    const duration = await readDuration(video);
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new VideoDecodeError("не удалось прочитать размер кадра");

    const out = outputSize(width, height);
    const total = frameCount(duration, out);
    const canvas = document.createElement("canvas");
    canvas.width = out.width;
    canvas.height = out.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new VideoDecodeError("браузер не даёт рисовать кадры");

    // Последний кадр берём чуть раньше конца файла: на самой границе часть
    // браузеров показывает пустоту (та же причина, что и у параллакс-видео).
    const last = Math.max(0, duration - 0.05);
    const blobs: Blob[] = [];
    for (let index = 0; index < total; index += 1) {
      await seekTo(video, total > 1 ? (index / (total - 1)) * last : 0);
      ctx.drawImage(video, 0, 0, out.width, out.height);
      blobs.push(await encodeCanvas(canvas));
      onProgress?.({ stage: "encode", done: index + 1, total });
    }
    return { blobs, ratio: width / height };
  } finally {
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}

/**
 * Полный путь сохранения ролика: видео → кадры → Storage. Панель вызывает его
 * при каждой загрузке видео в параллакс-блок — ролик как файл не хранится.
 */
export async function videoToFrames(
  file: File,
  onProgress?: (progress: FrameProgress) => void,
): Promise<{ frames: string[]; ratio: number }> {
  const { blobs, ratio } = await extractVideoFrames(file, onProgress);
  const frames = await uploadFrameSequence(blobs, FRAMES_FOLDER, (done, total) =>
    onProgress?.({ stage: "upload", done, total }),
  );
  return { frames, ratio };
}
