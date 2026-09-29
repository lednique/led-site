import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { detectRegion, type Region } from "./lib/region";

type RegionCtx = {
  /** Какая версия сайта показывается: российская или международная. */
  region: Region;
  /** Регион ещё определяется — в это время показываем российскую версию. */
  pending: boolean;
};

/**
 * Регион по IP (см. `api/region.ts` и `src/lib/region.ts`).
 *
 * До ответа сервера значение по умолчанию — «ru»: российская версия не
 * содержит формы, собирающей персональные данные, и не показывает иконки
 * соцсетей Meta, поэтому показывать её по умолчанию безопаснее.
 */
const RegionContext = createContext<RegionCtx>({ region: "ru", pending: true });

export function RegionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RegionCtx>({ region: "ru", pending: true });

  useEffect(() => {
    let cancelled = false;
    detectRegion().then((region) => {
      if (!cancelled) setState({ region, pending: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <RegionContext.Provider value={state}>{children}</RegionContext.Provider>;
}

export function useRegion(): RegionCtx {
  return useContext(RegionContext);
}

/** Российская версия: без формы заявок и без иконок соцсетей. */
export function isRussianRegion({ region, pending }: RegionCtx): boolean {
  return pending || region === "ru";
}
