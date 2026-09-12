import { memo, useEffect, useRef } from "react";

type EmbedBlockProps = {
  /** Вставной HTML стороннего сервиса (iframe, виджет, плеер…). */
  code: string;
};

/**
 * Встраиваемый код сторонних сервисов.
 *
 * HTML пишется в DOM ровно один раз (и только когда сам код изменился) —
 * обычные перерисовки статьи (скролл, realtime-обновления, смена маршрута)
 * узел не трогают, поэтому плееры/виджеты не перезапускаются.
 *
 * Дополнительно каждый iframe доводится до стабильного состояния:
 * - `scrolling="no"` — у виджета нет собственной прокрутки, свайп листает статью;
 * - `loading="eager"` — ленивый фрейм браузер мог бы выгрузить вне экрана
 *   и загрузить заново при возврате, что выглядело как «перезапуск» виджета.
 */
export const EmbedBlock = memo(function EmbedBlock({ code }: EmbedBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Тот же код повторно не пишем: перезапись innerHTML пересоздала бы
    // iframe и перезапустила бы виджет.
    if (el.dataset.code === code) return;
    el.innerHTML = code;
    el.dataset.code = code;
    el.querySelectorAll("iframe").forEach((frame) => {
      frame.setAttribute("scrolling", "no");
      if (frame.getAttribute("loading") !== "eager") {
        frame.setAttribute("loading", "eager");
      }
    });
  }, [code]);

  return <div ref={ref} className="block-embed" />;
});
