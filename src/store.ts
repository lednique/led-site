import { useEffect, useSyncExternalStore } from "react";
import { defaultSite, SITE_VERSION } from "./defaults";
import { supabase } from "./lib/supabase";
import { ensureRemoteSrc } from "./lib/upload";
import type { BannerData, Locale, Publication, SiteData } from "./types";

const LOCAL_KEYS = ["lednique-site-v4", "lednique-site-v3"];

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

type SettingsRow = {
  id: number;
  banner?: BannerData & { favicon?: string };
  nav?: SiteData["nav"];
  socials?: SiteData["socials"];
  favicon?: string | null;
};

export type SyncMode = "live" | "local" | "offline";

export type SyncState = {
  ready: boolean;
  mode: SyncMode;
  error: string | null;
  migrated: boolean;
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
  if (pubs.every((p) => typeof p.order === "number")) return { ...defaultSite, ...data, publications: pubs };
  const byDate = [...pubs].sort((a, b) => b.createdAt - a.createdAt);
  return {
    ...defaultSite,
    ...data,
    publications: pubs.map((p) => ({
      ...p,
      order: byDate.findIndex((x) => x.id === p.id),
    })),
  };
}

function loadLocal(): SiteData | null {
  try {
    for (const key of LOCAL_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SiteData;
      if (!parsed || !Array.isArray(parsed.publications)) continue;
      return withOrder({ ...defaultSite, ...parsed, favicon: parsed.favicon ?? "" });
    }
  } catch {
    /* ignore */
  }
  return null;
}

function isFilledBanner(banner: BannerData | undefined): boolean {
  if (!banner) return false;
  return Boolean(banner.image || banner.title?.en || banner.title?.ru || banner.brand?.en || banner.brand?.ru);
}

function isCustomized(data: SiteData): boolean {
  const defIds = new Set(defaultSite.publications.map((p) => p.id));
  if (data.favicon) return true;
  if (data.publications.some((p) => !defIds.has(p.id))) return true;
  if (data.publications.length !== defaultSite.publications.length) return true;
  if (data.banner.image.startsWith("data:") || data.banner.image.startsWith("http")) return true;
  if (data.publications.some((p) => p.image.startsWith("data:") || p.image.startsWith("http"))) return true;
  if (JSON.stringify(data.banner.title) !== JSON.stringify(defaultSite.banner.title)) return true;
  if (
    JSON.stringify(data.publications.map((p) => [p.id, p.title, p.color, p.type, p.url])) !==
    JSON.stringify(defaultSite.publications.map((p) => [p.id, p.title, p.color, p.type, p.url]))
  ) {
    return true;
  }
  return false;
}

function bannerFromRow(raw: SettingsRow["banner"] | undefined, fallback: BannerData): BannerData {
  if (!raw || !isFilledBanner(raw)) return fallback;
  return {
    image: raw.image ?? fallback.image,
    brand: raw.brand ?? fallback.brand,
    title: raw.title ?? fallback.title,
    cta: raw.cta ?? fallback.cta,
    url: raw.url ?? fallback.url,
  };
}

function applySettings(base: SiteData, row: SettingsRow | null): SiteData {
  if (!row) return base;
  const embedded = row.banner && "favicon" in row.banner ? row.banner.favicon : "";
  return {
    ...base,
    banner: bannerFromRow(row.banner, base.banner),
    nav: row.nav?.length ? row.nav : base.nav,
    socials: row.socials?.length ? row.socials : base.socials,
    favicon: row.favicon || embedded || base.favicon || "",
  };
}

function signature(data: SiteData): string {
  return JSON.stringify({
    favicon: data.favicon,
    banner: data.banner,
    nav: data.nav,
    socials: data.socials,
    pubs: [...data.publications]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p) => [p.id, p.createdAt, p.order, p.title, p.color, p.image, p.type, p.url, p.hashtags, p.enEnabled, p.blocks]),
  });
}

let state: SiteData = defaultSite;
let sync: SyncState = {
  ready: !supabase,
  mode: supabase ? "live" : "local",
  error: null,
  migrated: false,
};
const listeners = new Set<() => void>();
let settingsTimer: number | undefined;
let realtimeChannel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function setSync(partial: Partial<SyncState>) {
  sync = { ...sync, ...partial };
  emit();
}

function cacheLocal(data: SiteData) {
  try {
    localStorage.setItem(LOCAL_KEYS[0], JSON.stringify({ ...data, version: SITE_VERSION }));
  } catch {
    /* quota */
  }
}

export function getSite(): SiteData {
  return state;
}

export function getSync(): SyncState {
  return sync;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function replaceSite(next: SiteData, cache = true) {
  const normalized = { ...defaultSite, ...next, version: SITE_VERSION, favicon: next.favicon ?? "" };
  if (signature(normalized) === signature(state) && state !== defaultSite) {
    state = normalized;
    return;
  }
  state = normalized;
  if (cache) cacheLocal(state);
  emit();
}

export function setSite(next: SiteData) {
  replaceSite(next);
}

export function patchSite(partial: Partial<SiteData>) {
  replaceSite({ ...state, ...partial });
  queuePersistSettings();
}

export function useSite(): SiteData {
  return useSyncExternalStore(subscribe, getSite, () => defaultSite);
}

export function useSiteReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => sync.ready,
    () => true,
  );
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, getSync, () => sync);
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

async function materializePublication(pub: Publication): Promise<Publication> {
  // Одна и та же картинка в английской и русской версии должна получить один
  // путь на сервере, поэтому загрузку кешируем по исходному data: URL.
  const uploads = new Map<string, Promise<string>>();
  const uploadOnce = (src: string, folder: string) => {
    const cached = uploads.get(src);
    if (cached) return cached;
    const started = ensureRemoteSrc(src, folder);
    uploads.set(src, started);
    return started;
  };

  const materializeBlocks = (blocks: Publication["blocks"]["en"]) =>
    Promise.all(
      blocks.map(async (block) =>
        block.type === "image" ? { ...block, src: await uploadOnce(block.src, "article") } : block,
      ),
    );

  const [image, en, ru] = await Promise.all([
    uploadOnce(pub.image, "cards"),
    materializeBlocks(pub.blocks.en),
    materializeBlocks(pub.blocks.ru),
  ]);
  return { ...pub, image, blocks: { en, ru } };
}

async function persistSettings() {
  if (!supabase) return;
  const banner = { ...state.banner, ...(state.favicon ? { favicon: state.favicon } : {}) };
  const payload = {
    id: 1,
    banner,
    nav: state.nav,
    socials: state.socials,
    favicon: state.favicon ?? "",
  };
  const first = await supabase.from("site_settings").upsert(payload);
  if (!first.error) {
    setSync({ error: null, mode: "live" });
    return;
  }
  const fallback = await supabase.from("site_settings").upsert({
    id: 1,
    banner,
    nav: state.nav,
    socials: state.socials,
  });
  if (fallback.error) {
    setSync({ error: fallback.error.message, mode: "offline" });
    return;
  }
  setSync({ error: null, mode: "live" });
}

function queuePersistSettings() {
  window.clearTimeout(settingsTimer);
  settingsTimer = window.setTimeout(() => {
    void persistSettings();
  }, 280);
}

async function persistPublication(pub: Publication) {
  if (!supabase) return;
  const readyPub = await materializePublication(pub);
  if (readyPub.image !== pub.image || readyPub.blocks !== pub.blocks) {
    replaceSite({
      ...state,
      publications: state.publications.map((p) => (p.id === readyPub.id ? readyPub : p)),
    });
  }
  const { error } = await supabase.from("publications").upsert(pubToRow(readyPub));
  if (error) {
    setSync({ error: error.message, mode: "offline" });
    return;
  }
  setSync({ error: null, mode: "live" });
}

export function savePublication(pub: Publication) {
  const exists = state.publications.some((p) => p.id === pub.id);
  if (exists) {
    replaceSite({
      publications: state.publications.map((p) => (p.id === pub.id ? pub : p)),
      banner: state.banner,
      nav: state.nav,
      socials: state.socials,
      favicon: state.favicon,
      version: SITE_VERSION,
    });
  } else {
    const min = state.publications.reduce((m, p) => Math.min(m, p.order ?? 0), 0);
    const next = { ...pub, order: min - 1 };
    replaceSite({
      ...state,
      publications: [next, ...state.publications],
    });
    void persistPublication(next);
    return;
  }
  void persistPublication(pub);
}

export function removePublication(id: string) {
  replaceSite({ ...state, publications: state.publications.filter((p) => p.id !== id) });
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
  replaceSite({ ...state, publications: mapped });
  if (supabase) {
    void Promise.all(mapped.map((p) => supabase!.from("publications").update({ sort_order: p.order }).eq("id", p.id)));
  }
}

async function pushSite(data: SiteData) {
  if (!supabase) return;
  const pubs = await Promise.all(data.publications.map((p) => materializePublication(p)));
  const bannerImage = await ensureRemoteSrc(data.banner.image, "banner");
  const socials = await Promise.all(
    data.socials.map(async (s) => ({ ...s, image: await ensureRemoteSrc(s.image, "socials") })),
  );
  const favicon = await ensureRemoteSrc(data.favicon, "favicon");
  const next: SiteData = {
    ...data,
    banner: { ...data.banner, image: bannerImage },
    socials,
    favicon,
    publications: pubs,
  };
  replaceSite(next);
  await persistSettings();
  const results = await Promise.all(pubs.map((p) => supabase!.from("publications").upsert(pubToRow(p))));
  const failed = results.find((r) => r.error);
  if (failed?.error) setSync({ error: failed.error.message, mode: "offline" });
}

function isLocalExtra(pub: Publication): boolean {
  const def = defaultSite.publications.find((d) => d.id === pub.id);
  if (!def) return true;
  return (
    JSON.stringify([pub.title, pub.image, pub.color, pub.type, pub.url, pub.hashtags]) !==
    JSON.stringify([def.title, def.image, def.color, def.type, def.url, def.hashtags])
  );
}

async function fetchRemote(): Promise<{ settings: SettingsRow | null; pubs: Row[]; error: string | null }> {
  if (!supabase) return { settings: null, pubs: [], error: null };
  const [settingsRes, pubsRes] = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("publications").select("*").order("created_at", { ascending: false }),
  ]);
  const error = settingsRes.error?.message || pubsRes.error?.message || null;
  return {
    settings: (settingsRes.data as SettingsRow | null) ?? null,
    pubs: (pubsRes.data as Row[] | null) ?? [],
    error,
  };
}

function remoteHasContent(settings: SettingsRow | null, pubs: Row[]): boolean {
  return pubs.length > 0 || isFilledBanner(settings?.banner) || Boolean(settings?.favicon);
}

export async function hydrateFromSupabase() {
  if (!supabase) {
    const local = loadLocal();
    if (local) replaceSite(local, false);
    setSync({ ready: true, mode: "local", error: null });
    return;
  }

  const local = loadLocal();
  const { settings, pubs, error } = await fetchRemote();

  if (error && !settings && pubs.length === 0) {
    if (local) replaceSite(local, false);
    setSync({ ready: true, mode: "offline", error, migrated: false });
    return;
  }

  const emptyRemote = !remoteHasContent(settings, pubs);
  if (emptyRemote && local && isCustomized(local)) {
    await pushSite(local);
    setSync({ ready: true, mode: "live", error: null, migrated: true });
    return;
  }

  let next = applySettings(defaultSite, settings);
  next = { ...next, publications: emptyRemote ? defaultSite.publications : pubs.map(rowToPub) };

  if (!emptyRemote && local) {
    const remoteIds = new Set(pubs.map((p) => p.id));
    const extras = local.publications.filter((p) => !remoteIds.has(p.id) && isLocalExtra(p));
    if (extras.length) {
      next = { ...next, publications: [...extras, ...next.publications] };
      replaceSite(next);
      await Promise.all(extras.map((p) => persistPublication(p)));
      setSync({ ready: true, mode: "live", error: null, migrated: true });
      return;
    }
  }

  replaceSite(next);
  setSync({ ready: true, mode: "live", error: null, migrated: false });
}

export async function refreshFromSupabase() {
  if (!supabase || !sync.ready) return;
  const { settings, pubs, error } = await fetchRemote();
  if (error) {
    setSync({ error, mode: "offline" });
    return;
  }
  if (!remoteHasContent(settings, pubs)) {
    replaceSite(applySettings(state, settings));
    setSync({ error: null, mode: "live" });
    return;
  }
  replaceSite({
    ...applySettings(state, settings),
    publications: pubs.map(rowToPub),
  });
  setSync({ error: null, mode: "live" });
}

function subscribeRealtime() {
  const client = supabase;
  if (!client) return () => undefined;
  const channel = client
    .channel("lednique-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, (payload) => {
      const row = (payload.new || payload.old) as SettingsRow | null;
      if (payload.eventType === "DELETE" || !row) return;
      replaceSite(applySettings(state, row));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "publications" }, (payload) => {
      if (payload.eventType === "DELETE") {
        const id = (payload.old as { id?: string } | null)?.id;
        if (!id) return;
        replaceSite({ ...state, publications: state.publications.filter((p) => p.id !== id) });
        return;
      }
      const row = payload.new as Row | null;
      if (!row?.id) return;
      const pub = rowToPub(row);
      const exists = state.publications.some((p) => p.id === pub.id);
      replaceSite({
        ...state,
        publications: exists ? state.publications.map((p) => (p.id === pub.id ? pub : p)) : [pub, ...state.publications],
      });
    })
    .subscribe();
  realtimeChannel = channel;
  return () => {
    void client.removeChannel(channel);
    if (realtimeChannel === channel) realtimeChannel = null;
  };
}

export function useHydrateSite() {
  useEffect(() => {
    let cancelled = false;
    let stopRealtime = () => undefined as void;
    void hydrateFromSupabase().then(() => {
      if (cancelled) return;
      stopRealtime = subscribeRealtime();
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshFromSupabase();
    };
    const onFocus = () => {
      void refreshFromSupabase();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      stopRealtime();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}

export function useBrandAssets() {
  const data = useSite();
  useEffect(() => {
    const href = data.favicon || "/favicon.svg";
    const rels = ["icon", "shortcut icon", "apple-touch-icon"];
    for (const rel of rels) {
      let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
      if (href.startsWith("data:image/png") || href.endsWith(".png")) link.type = "image/png";
      else if (href.startsWith("data:image/svg") || href.endsWith(".svg")) link.type = "image/svg+xml";
      else if (href.startsWith("data:image/jpeg") || href.endsWith(".jpg") || href.endsWith(".jpeg")) link.type = "image/jpeg";
      else link.removeAttribute("type");
    }
  }, [data.favicon]);
}
