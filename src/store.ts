import { useSyncExternalStore } from "react";
import { defaultSite, SITE_VERSION } from "./defaults";
import type { Publication, SiteData } from "./types";

const KEY = "lednique-site-v2";

function load(): SiteData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSite;
    const parsed = JSON.parse(raw) as SiteData;
    if (!parsed || parsed.version !== SITE_VERSION) return defaultSite;
    return parsed;
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
  return [...data.publications].sort((a, b) => b.createdAt - a.createdAt);
}

export function getPublication(id: string | undefined): Publication | undefined {
  if (!id) return undefined;
  return state.publications.find((p) => p.id === id);
}

export function savePublication(pub: Publication) {
  const exists = state.publications.some((p) => p.id === pub.id);
  const publications = exists
    ? state.publications.map((p) => (p.id === pub.id ? pub : p))
    : [pub, ...state.publications];
  patchSite({ publications });
}

export function removePublication(id: string) {
  patchSite({ publications: state.publications.filter((p) => p.id !== id) });
}

export function resetSite() {
  setSite(defaultSite);
}
