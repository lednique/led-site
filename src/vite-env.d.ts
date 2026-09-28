/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Запасной вход в панель, когда Supabase не подключён (локальная разработка). */
  readonly VITE_ADMIN_PASSWORD?: string;
  /** Почта администратора Supabase — подставляется в форму входа в панель. */
  readonly VITE_ADMIN_EMAIL?: string;
  /** Регион для локальной разработки: "ru" (по умолчанию) или "global". */
  readonly VITE_DEV_REGION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
