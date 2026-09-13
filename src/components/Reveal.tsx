import { useEffect, useRef, useState, type ReactNode } from "react";
import { scrollParent } from "../lib/scroll";

type RevealProps = {
  children: ReactNode;
  /** Пока статья под экраном загрузки, анимацию не запускаем. */
  paused?: boolean;
};

/**
 * Появление блока статьи при прокрутке: та же анимация, что у карточек ленты
 * (плавный fade плюс сдвиг снизу вверх). Блок «проявляется» один раз — когда
 * впервые попал в окно просмотра, и больше не прячется при обратной прокрутке.
 *
 * Наблюдаем через IntersectionObserver с root = scrollport статьи
 * (`.stage-reader`), поэтому работает и на компьютере, и на телефоне.
 */
export function Reveal({ children, paused = false }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown || paused) return;
    const el = ref.current;
    if (!el) return;

    // Без IntersectionObserver (очень старые браузеры) блок просто виден.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const root = scrollParent(el);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.disconnect();
        }
      },
      // Небольшой отступ снизу: блок начинает проявляться, не дожидаясь,
      // пока полностью попадёт в кадр.
      { root, rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown, paused]);

  return (
    <div ref={ref} className={`block-reveal${shown ? " is-in" : ""}`}>
      {children}
    </div>
  );
}
