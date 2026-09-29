-- Вставьте этот файл в Supabase → SQL Editor → Run
-- Можно запускать повторно: команды безопасны для уже существующей базы.

create table if not exists public.publications (
  id text primary key,
  created_at timestamptz not null default now(),
  sort_order int not null default 0,
  type text not null check (type in ('link', 'article')),
  color text not null default '#5A5A5A',
  image text not null default '',
  url text default '',
  en_enabled boolean not null default true,
  hashtags text[] not null default '{}',
  title_en text not null default '',
  title_ru text not null default '',
  blocks_en jsonb not null default '[]'::jsonb,
  blocks_ru jsonb not null default '[]'::jsonb
);

create table if not exists public.site_settings (
  id int primary key default 1,
  banner jsonb not null default '{}'::jsonb,
  nav jsonb not null default '[]'::jsonb,
  socials jsonb not null default '[]'::jsonb
);

alter table public.site_settings add column if not exists favicon text not null default '';

-- Страницы верхнего меню (Обо мне, Заказать работу, Контакты) и цвет статус-бара.
-- Старовым базам достаточно повторно запустить этот файл; данные также
-- продублированы внутри banner jsonb, поэтому работают и без миграции.
alter table public.site_settings add column if not exists pages jsonb not null default '{}'::jsonb;
alter table public.site_settings add column if not exists theme_color text not null default '#000000';

insert into public.site_settings (id) values (1)
on conflict (id) do nothing;

-- Доступ: чтение — всем (сайт публичный), запись — только владельцу после входа
-- в панель через Supabase Auth (роль `authenticated`).
--
-- Раньше политики разрешали запись любому, у кого есть анонимный ключ, а ключ
-- лежит во фронтенде: содержимое сайта и файлы в Storage мог изменить или
-- удалить любой посетитель. Для 152-ФЗ это ещё и невыполнение обязанности
-- принимать меры защиты (ст. 19, ПП РФ № 1119).
--
-- ВАЖНО: после запуска этого файла панель /admin просит почту и пароль
-- пользователя Supabase (Authentication → Users → Add user, галочка
-- Auto Confirm User). Подробности — SETUP.md, часть 4 «Панель управления».
alter table public.publications enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "pub read" on public.publications;
drop policy if exists "pub write" on public.publications;
drop policy if exists "set read" on public.site_settings;
drop policy if exists "set write" on public.site_settings;

create policy "pub read" on public.publications for select to anon, authenticated using (true);
create policy "pub write" on public.publications for all to authenticated using (true) with check (true);
create policy "set read" on public.site_settings for select to anon, authenticated using (true);
create policy "set write" on public.site_settings for all to authenticated using (true) with check (true);

-- Мгновенная синхронизация между устройствами
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'publications'
  ) then
    execute 'alter publication supabase_realtime add table public.publications';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_settings'
  ) then
    execute 'alter publication supabase_realtime add table public.site_settings';
  end if;
end $$;

-- Картинки (баннер, карточки, favicon) и видео параллакс-блоков хранятся
-- в Storage, в базе — только ссылки. Анимированные GIF и APNG загружаются
-- без пережатия, видео — тем более, поэтому лимит поднят до 50 МБ.
--
-- Типы файлов заданы шаблонами (image/*, video/*), а не перечнем: Supabase
-- сверяет присланный MIME со списком буквально, а браузеры называют одно и то
-- же видео по-разному (video/mp4, video/x-m4v, video/quicktime, video/3gpp…).
-- Точный перечень рано или поздно заканчивался в панели ошибкой
-- «mime type video/mp4 is not supported» — шаблон принимает любой формат
-- своего семейства, по-прежнему не пуская в корзину ничего постороннего.
-- Запуск файла заново чинит и корзину, созданную старой версией (только
-- картинки), и корзину, настроенную руками в дашборде.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['image/*', 'video/*'])
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media read" on storage.objects;
drop policy if exists "media write" on storage.objects;
drop policy if exists "media update" on storage.objects;
drop policy if exists "media delete" on storage.objects;

-- Читать картинки и видео может кто угодно, загружать/заменять/удалять —
-- только авторизованный владелец панели.
create policy "media read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'media');

create policy "media write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media');

create policy "media update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media')
  with check (bucket_id = 'media');

create policy "media delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media');
