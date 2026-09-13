import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ArticleBlock } from "../types";

/**
 * Связь тяжёлых блоков статьи (параллакс-видео) с читалкой.
 *
 * Пока хотя бы одно видео статьи не готово к показу, статья закрыта экраном
 * загрузки: `holding === true`. Анимация появления блоков в это время тоже
 * стоит на паузе — иначе она прошла бы за закрытым экраном.
 */
export type ArticleMediaGate = {
  /** Статья ещё под экраном загрузки. */
  holding: boolean;
  /** Блок сообщает, что он готов к показу (загрузился или не смог). */
  markReady: (id: string) => void;
};

const ArticleMediaContext = createContext<ArticleMediaGate | null>(null);

export const ArticleMediaProvider = ArticleMediaContext.Provider;

export function useArticleMedia(): ArticleMediaGate | null {
  return useContext(ArticleMediaContext);
}

/** Сколько максимум ждём видео, прежде чем показать статью как есть. */
const GATE_TIMEOUT = 12000;

/**
 * Готовность медиа статьи. Ждём только параллакс-видео: остальные блоки
 * (текст, картинки, галереи) появляются по мере загрузки и экран показа не
 * задерживают.
 */
export function useArticleMediaGate(blocks: ArticleBlock[]): ArticleMediaGate {
  const pending = useMemo(
    () =>
      blocks
        // Ждём и видеофайл, и нарезанные из него кадры: и то и другое
        // показывает один и тот же параллакс-блок.
        .filter((b): b is Extract<ArticleBlock, { type: "video" }> => b.type === "video" && (Boolean(b.src) || Boolean(b.frames?.length)))
        .map((b) => b.id),
    [blocks],
  );
  const key = pending.join("|");
  const [ready, setReady] = useState<string[]>([]);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setReady([]);
    setTimedOut(false);
    if (!key) return;
    // Медленная сеть не должна держать статью закрытой бесконечно.
    const timer = window.setTimeout(() => setTimedOut(true), GATE_TIMEOUT);
    return () => window.clearTimeout(timer);
  }, [key]);

  const markReady = useCallback((id: string) => {
    setReady((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const holding = !timedOut && pending.some((id) => !ready.includes(id));

  return useMemo(() => ({ holding, markReady }), [holding, markReady]);
}
