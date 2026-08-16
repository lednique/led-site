import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";

type GooglePhoto = {
  id: string;
  src: string;
  width?: number;
  height?: number;
  /** Описание, заданное пользователем в Google Photos. Пустая строка = нет подписи. */
  description?: string;
};

type AlbumResponse = {
  photos: GooglePhoto[];
};

type GalleryState =
  | { album: string; status: "loading"; photos: GooglePhoto[]; error: "" }
  | { album: string; status: "ready"; photos: GooglePhoto[]; error: "" }
  | { album: string; status: "error"; photos: GooglePhoto[]; error: string };

const CACHE_LIFETIME = 5 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; data: AlbumResponse }>();
const pendingRequests = new Map<string, Promise<AlbumResponse>>();

function isGooglePhoto(value: unknown): value is GooglePhoto {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GooglePhoto>;
  return (
    typeof item.id === "string" &&
    typeof item.src === "string" &&
    item.src.startsWith("https://") &&
    // description — опциональное поле; если оно есть, должно быть строкой.
    (item.description === undefined || typeof item.description === "string")
  );
}

async function fetchAlbum(album: string): Promise<AlbumResponse> {
  const now = Date.now();
  const cached = responseCache.get(album);
  if (cached && cached.expiresAt > now) return cached.data;

  const pending = pendingRequests.get(album);
  if (pending) return pending;

  const request = fetch(`/api/google-photos?album=${encodeURIComponent(album)}`)
    .then(async (response) => {
      const body = (await response.json().catch(() => null)) as { photos?: unknown; error?: unknown } | null;
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Could not load Google Photos album");
      }
      const photos = Array.isArray(body?.photos) ? body.photos.filter(isGooglePhoto) : [];
      if (!photos.length) throw new Error("No photos were found in this album");
      const data = { photos };
      responseCache.set(album, { data, expiresAt: Date.now() + CACHE_LIFETIME });
      return data;
    })
    .finally(() => {
      pendingRequests.delete(album);
    });

  pendingRequests.set(album, request);
  return request;
}

/**
 * Google отдаёт публичные ссылки без размера. Добавляем высоту, достаточную
 * для 340 CSS px на экранах с высокой плотностью, не загружая оригинал.
 * h1200 покрывает и 250px мобильную высоту с запасом под retina.
 */
function sizedGooglePhotoSrc(src: string): string {
  const hashAt = src.indexOf("#");
  const withoutHash = hashAt >= 0 ? src.slice(0, hashAt) : src;
  const queryAt = withoutHash.indexOf("?");
  const path = queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash;
  const query = queryAt >= 0 ? withoutHash.slice(queryAt) : "";
  const sizeAt = path.lastIndexOf("=");
  const base = sizeAt > path.lastIndexOf("/") ? path.slice(0, sizeAt) : path;
  return `${base}=h1200-no${query}`;
}

export function GooglePhotosGallery({ albumUrl }: { albumUrl: string }) {
  const { t } = useI18n();
  const album = albumUrl.trim();
  const [state, setState] = useState<GalleryState>({ album: "", status: "loading", photos: [], error: "" });

  useEffect(() => {
    let current = true;

    if (!album) {
      setState({ album, status: "ready", photos: [], error: "" });
      return () => {
        current = false;
      };
    }

    setState((previous) =>
      previous.album === album && previous.status === "ready"
        ? previous
        : { album, status: "loading", photos: [], error: "" },
    );

    void fetchAlbum(album).then(
      (data) => {
        if (current) setState({ album, status: "ready", photos: data.photos, error: "" });
      },
      (error: unknown) => {
        if (!current) return;
        const message = error instanceof Error ? error.message : "Could not load Google Photos album";
        setState({ album, status: "error", photos: [], error: message });
      },
    );

    return () => {
      current = false;
    };
  }, [album]);

  if (!album) return null;

  const isLoading = state.album !== album || state.status === "loading";
  if (isLoading) {
    return (
      <section className="google-photos-gallery google-photos-gallery--status" aria-busy="true">
        <span>{t("Loading Google Photos…", "Портфолио загружаются…")}</span>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="google-photos-gallery google-photos-gallery--status" role="status">
        <span>{t("The Google Photos album could not be loaded.", "Не удалось загрузить альбом Google Photos.")}</span>
      </section>
    );
  }

  if (!state.photos.length) return null;

  return (
    <section className="google-photos-gallery" aria-label={t("Google Photos gallery", "Галерея Google Photos")}>
      {state.photos.map((photo, index) => (
        <GalleryPhoto key={photo.id || photo.src} photo={photo} index={index} />
      ))}
    </section>
  );
}

function GalleryPhoto({ photo, index }: { photo: GooglePhoto; index: number }) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasMoreToRight, setHasMoreToRight] = useState(false);

  const updateOverflow = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const hasMore = scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft > 1;
    setHasMoreToRight((current) => (current === hasMore ? current : hasMore));
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return undefined;

    updateOverflow();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateOverflow);
    resizeObserver?.observe(scroller);
    window.addEventListener("resize", updateOverflow);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [photo.src, updateOverflow]);

  const caption = photo.description?.trim() ?? "";

  return (
    <figure className="google-photos-item">
      <div className="google-photos-frame">
        <div
          ref={scrollRef}
          className="google-photos-scroll"
          onScroll={updateOverflow}
          aria-label={t(`Photo ${index + 1}`, `Фото ${index + 1}`)}
          tabIndex={0}
        >
          <img
            className="google-photos-image"
            src={sizedGooglePhotoSrc(photo.src)}
            alt={caption}
            draggable={false}
            loading="lazy"
            decoding="async"
            onLoad={updateOverflow}
            onDragStart={(event) => event.preventDefault()}
          />
        </div>
        {hasMoreToRight && <GalleryScrollHint />}
      </div>
      {caption && <figcaption className="google-photos-caption">{caption}</figcaption>}
    </figure>
  );
}

/** Подсказка, что продолжение изображения доступно свайпом влево. */
function GalleryScrollHint() {
  return (
    <div className="google-photos-scroll-hint" aria-hidden="true">
      <div data-svg-wrapper>
        <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M15 0H1.5C1.10218 0 0.720644 0.158035 0.43934 0.43934C0.158035 0.720644 0 1.10218 0 1.5V15C0 15.3978 0.158035 15.7794 0.43934 16.0607C0.720644 16.342 1.10218 16.5 1.5 16.5H15C15.3978 16.5 15.7794 16.342 16.0607 16.0607C16.342 15.7794 16.5 15.3978 16.5 15V1.5C16.5 1.10218 16.342 0.720644 16.0607 0.43934C15.7794 0.158035 15.3978 0 15 0ZM9 7.5H15V9H9V7.5ZM9 6V4.5H15V6H9ZM9 10.5H15V12H9V10.5ZM15 3H9V1.5H15V3ZM1.5 1.5H7.5V15H1.5V1.5ZM15 15H9V13.5H15V15Z"
            fill="black"
          />
        </svg>
      </div>
    </div>
  );
}
