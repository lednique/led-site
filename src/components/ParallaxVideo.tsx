import { useEffect, useRef, useState, type CSSProperties } from "react";
import { resolveSrc } from "../media";
import { scrollParent, viewportBox } from "../lib/scroll";
import { useArticleMedia } from "./ArticleMedia";

type ParallaxVideoProps = {
  /** Идентификатор блока — им блок отмечается в «шлюзе» готовности статьи. */
  id: string;
  /** Ссылка на видеофайл. */
  src: string;
};

/**
 * Параллакс-видео: кадр привязан к прокрутке статьи.
 *
 * Ролик не проигрывается сам — вместо этого позиция блока в окне просмотра
 * пересчитывается в `currentTime`. Первый кадр стоит, пока блок только входит
 * снизу; последний — в тот момент, когда нижняя граница блока уходит за
 * верхнюю границу статьи. Плеера, кнопок и звука нет.
 *
 * Ради плавности время меняем в rAF-кадре и только когда оно действительно
 * изменилось: перемотка тяжелее самой отрисовки, а лишние seek'и на мобильных
 * WebKit вызывают заметные подтормаживания.
 */
export function ParallaxVideo({ id, src }: ParallaxVideoProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const gate = useArticleMedia();
  const [ready, setReady] = useState(false);
  // Пропорции кадра берём из самого файла: на мобильной ролик показывается
  // целиком от края до края, поэтому высота блока должна совпадать с видео.
  const [ratio, setRatio] = useState(0);

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

  // Сообщаем читалке о готовности ровно один раз: пока все видео статьи не
  // загрузились, поверх неё висит экран загрузки.
  const markReady = gate?.markReady;
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!src) {
      markReady?.(id);
      setReady(true);
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setReady(true);
      markReady?.(id);
    };

    // readyState ≥ 2 (HAVE_CURRENT_DATA) значит, что первый кадр уже есть.
    if (video.readyState >= 2) finish();
    video.addEventListener("loadeddata", finish);
    video.addEventListener("canplay", finish);
    // Ошибка не должна держать статью закрытой — показываем её без ролика.
    video.addEventListener("error", finish);
    // Страховка от «вечной» загрузки на медленной сети.
    const timeout = window.setTimeout(finish, 8000);

    return () => {
      video.removeEventListener("loadeddata", finish);
      video.removeEventListener("canplay", finish);
      video.removeEventListener("error", finish);
      window.clearTimeout(timeout);
    };
  }, [id, src, markReady]);

  useEffect(() => {
    const holder = holderRef.current;
    const video = videoRef.current;
    if (!holder || !video || !src) return;

    const scroller = scrollParent(holder);
    let frame = 0;
    /** Кадр, который должен стоять сейчас; -1 — ещё ничего не считали. */
    let wanted = -1;
    /** Кадр, который уже отдан браузеру. */
    let applied = -1;

    const seek = () => {
      // Пока идёт предыдущая перемотка, новую не начинаем: на мобильных
      // WebKit очередь seek'ов превращается в рывки. Нужный кадр останется
      // в `wanted` и доедет по событию seeked.
      if (wanted < 0 || video.seeking || video.readyState < 1) return;
      if (Math.abs(wanted - applied) < 0.01) return;
      applied = wanted;
      try {
        video.currentTime = wanted;
      } catch {
        /* перемотка до готовности метаданных — просто пропускаем кадр */
      }
    };

    const apply = () => {
      frame = 0;
      const duration = video.duration;
      if (!duration || !Number.isFinite(duration)) return;

      const box = holder.getBoundingClientRect();
      const view = viewportBox(scroller);

      // Путь блока: от «верх блока на нижней границе окна» до «низ блока за
      // верхней границей окна». Прогресс 0 — первый кадр, 1 — последний.
      const distance = view.height + box.height;
      const travelled = view.top + view.height - box.top;
      const progress = distance > 0 ? travelled / distance : 0;
      const clamped = Math.min(1, Math.max(0, progress));

      // Последний кадр не ставим ровно в duration: часть браузеров на этом
      // месте показывает пустоту вместо кадра.
      wanted = Math.min(duration - 0.05, clamped * duration);
      seek();
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    const target: (HTMLElement | Window)[] = scroller ? [scroller, window] : [window];
    target.forEach((node) => node.addEventListener("scroll", schedule, { passive: true }));
    window.addEventListener("resize", schedule);
    // Метаданные дают длительность, seeked — возможность догнать кадр,
    // который накопился, пока шла предыдущая перемотка.
    video.addEventListener("loadedmetadata", schedule);
    video.addEventListener("seeked", seek);
    schedule();

    return () => {
      target.forEach((node) => node.removeEventListener("scroll", schedule));
      window.removeEventListener("resize", schedule);
      video.removeEventListener("loadedmetadata", schedule);
      video.removeEventListener("seeked", seek);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [src]);

  return (
    <div
      ref={holderRef}
      className={`block-video${ready ? " is-ready" : ""}`}
      style={ratio ? ({ "--video-ratio": String(ratio) } as CSSProperties) : undefined}
    >
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
