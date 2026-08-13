import { useEffect, useSyncExternalStore } from "react";
import { defaultSite, SITE_VERSION } from "./defaults";
import { supabase } from "./lib/supabase";
import type { Locale, Publication, SiteData } from "./types";

const KEY = "lednique-site-v3";

type Row = {
  id: string;
  created_at: string;
  sort_order: number;
  type: "link" | "article";
  color: string;
  image: string;
  url: string | null;
  en_enabled: boolean;
  hashtags: string[] | null;
  title_en: string;
  title_ru: string;
  blocks_en: Publication["blocks"]["en"];
  blocks_ru: Publication["blocks"]["ru"];
};

function loc(en: string, ru: string) {
  return { en, ru };
}

function rowToPub(row: Row): Publication {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    order: row.sort_order,
    title: loc(row.title_en ?? "", row.title_ru ?? ""),
    type: row.type,
    color: row.color || "#5A5A5A",
    image: row.image || "",
    url: row.url ?? "",
    hashtags: row.hashtags ?? [],
    enEnabled: row.en_enabled !== false,
    blocks: { en: row.blocks_en ?? [], ru: row.blocks_ru ?? [] },
  };
}

function pubToRow(pub: Publication) {
  return {
    id: pub.id,
    created_at: new Date(pub.createdAt).toISOString(),
    sort_order: pub.order,
    type: pub.type,
    color: pub.color,
    image: pub.image,
    url: pub.url ?? "",
    en_enabled: pub.enEnabled,
    hashtags: pub.hashtags,
    title_en: pub.title.en,
    title_ru: pub.title.ru,
    blocks_en: pub.blocks.en,
    blocks_ru: pub.blocks.ru,
  };
}

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
    const parsed = JSON.parse(raw) as SiteData;
    if (!parsed || parsed.version !== SITE_VERSION) return defaultSite;
    return withOrder(parsed);
  } catch {
    return defaultSite;
  }
}

let state: SiteData = typeof window === "undefined" ? defaultSite : load();
let ready = !supabase;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persistLocal() {
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
  persistLocal();
  emit();
}

export function patchSite(partial: Partial<SiteData>) {
  setSite({ ...state, ...partial });
  void persistSettings();
}

export function useSite(): SiteData {
  return useSyncExternalStore(subscribe, getSite, () => defaultSite);
}

export function useSiteReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => ready,
    () => true,
  );
}

export function sortedPublications(data: SiteData = state): Publication[] {
  return [...data.publications].sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return b.createdAt - a.createdAt;
  });
}

export function visiblePublications(data: SiteData, locale: Locale): Publication[] {
  return sortedPublications(data)
    .filter((p) => (locale === "en" ? p.enEnabled : true))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getPublication(id: string | undefined): Publication | undefined {
  if (!id) return undefined;
  return state.publications.find((p) => p.id === id);
}

async function persistSettings() {
  if (!supabase) return;
  await supabase.from("site_settings").upsert({
    id: 1,
    banner: state.banner,
    nav: state.nav,
    socials: state.socials,
  });
}

async function persistPublication(pub: Publication) {
  if (!supabase) return;
  await supabase.from("publications").upsert(pubToRow(pub));
}

export function savePublication(pub: Publication) {
  const exists = state.publications.some((p) => p.id === pub.id);
  if (exists) {
    patchSite({
      publications: state.publications.map((p) => (p.id === pub.id ? pub : p)),
    });
  } else {
    const min = state.publications.reduce((m, p) => Math.min(m, p.order ?? 0), 0);
    const next = { ...pub, order: min - 1 };
    patchSite({ publications: [next, ...state.publications] });
    void persistPublication(next);
    return;
  }
  void persistPublication(pub);
}

export function removePublication(id: string) {
  patchSite({ publications: state.publications.filter((p) => p.id !== id) });
  if (supabase) void supabase.from("publications").delete().eq("id", id);
}

export function movePublication(id: string, dir: -1 | 1) {
  const pubs = sortedPublications();
  const i = pubs.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= pubs.length) return;
  const next = [...pubs];
  const [item] = next.splice(i, 1);
  next.splice(j, 0, item);
  const mapped = next.map((p, index) => ({ ...p, order: index }));
  patchSite({ publications: mapped });
  if (supabase) {
    void Promise.all(mapped.map((p) => supabase!.from("publications").update({ sort_order: p.order }).eq("id", p.id)));
  }
}

export async function hydrateFromSupabase() {
  if (!supabase) {
    ready = true;
    emit();
    return;
  }
  const [settingsRes, pubsRes] = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("publications").select("*").order("created_at", { ascending: false }),
  ]);

  const next = { ...state };
  if (settingsRes.data) {
    next.banner = settingsRes.data.banner ?? next.banner;
    next.nav = settingsRes.data.nav ?? next.nav;
    next.socials = settingsRes.data.socials ?? next.socials;
  }
  if (pubsRes.data?.length) {
    next.publications = (pubsRes.data as Row[]).map(rowToPub);
  }
  state = next;
  persistLocal();
  ready = true;
  emit();
}

export function useHydrateSite() {
  useEffect(() => {
    void hydrateFromSupabase();
  }, []);
}
