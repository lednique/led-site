import { useSyncExternalStore } from "react";
import { defaultSite, SITE_VERSION } from "./defaults";
import type { Publication, SiteData } from "./types";

const KEY = "lednique-site-v2";

function withOrder(data: SiteData): SiteData {
  const pubs = data.publications ?? [];
  if (pubs.every((p) => typeof p.order === "number")) return data;
  const byDate = [...pubs].sort((a, b) => b.createdAt - a.createdAt);
  return {
    ...data,
    publications: pubs.map((p) => ({
      ...p,
      order: byDate.findIndex((x) => x.id === p.id),
    })),
  };
}

function load(): SiteData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSite;
    let parsed = JSON.parse(raw) as SiteData;
    if (!parsed || parsed.version !== SITE_VERSION) return defaultSite;
    if (parsed.banner?.image === "builtin:cyan") {
      parsed = { ...parsed, banner: { ...parsed.banner, image: "builtin:banner" } };
    }
    return withOrder(parsed);
  } catch {
    return defaultSite;
  }
}

let state: SiteData = typeof window === "undefined" ? defaultSite : load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function getSite(): SiteData {
  return state;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setSite(next: SiteData) {
  state = next;
  persist();
  emit();
}

export function patchSite(partial: Partial<SiteData>) {
  setSite({ ...state, ...partial });
}

export function useSite(): SiteData {
  return useSyncExternalStore(subscribe, getSite, () => defaultSite);
}

export function sortedPublications(data: SiteData = state): Publication[] {
  return [...data.publications].sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return b.createdAt - a.createdAt;
  });
}

export function getPublication(id: string | undefined): Publication | undefined {
  if (!id) return undefined;
  return state.publications.find((p) => p.id === id);
}

export function savePublication(pub: Publication) {
  const exists = state.publications.some((p) => p.id === pub.id);
  if (exists) {
    patchSite({
      publications: state.publications.map((p) => (p.id === pub.id ? pub : p)),
    });
    return;
  }
  const min = state.publications.reduce((m, p) => Math.min(m, p.order ?? 0), 0);
  patchSite({
    publications: [{ ...pub, order: min - 1 }, ...state.publications],
  });
}

export function removePublication(id: string) {
  patchSite({ publications: state.publications.filter((p) => p.id !== id) });
}

export function movePublication(id: string, dir: -1 | 1) {
  const pubs = sortedPublications();
  const i = pubs.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= pubs.length) return;
  const next = [...pubs];
  const [item] = next.splice(i, 1);
  next.splice(j, 0, item);
  patchSite({
    publications: next.map((p, index) => ({ ...p, order: index })),
  });
}

export function resetSite() {
  setSite(defaultSite);
}
