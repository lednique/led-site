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

insert into public.site_settings (id) values (1)
on conflict (id) do nothing;

alter table public.publications enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "pub read" on public.publications;
drop policy if exists "pub write" on public.publications;
drop policy if exists "set read" on public.site_settings;
drop policy if exists "set write" on public.site_settings;

create policy "pub read" on public.publications for select using (true);
create policy "pub write" on public.publications for all using (true) with check (true);
create policy "set read" on public.site_settings for select using (true);
create policy "set write" on public.site_settings for all using (true) with check (true);

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

-- Картинки (баннер, карточки, favicon) хранятся в Storage, в базе — только ссылки.
-- Анимированные GIF и APNG загружаются без пережатия, поэтому лимит 20 МБ.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/apng', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media read" on storage.objects;
drop policy if exists "media write" on storage.objects;
drop policy if exists "media update" on storage.objects;
drop policy if exists "media delete" on storage.objects;

create policy "media read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'media');

create policy "media write"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'media');

create policy "media update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'media')
  with check (bucket_id = 'media');

create policy "media delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'media');
