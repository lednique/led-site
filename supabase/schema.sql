-- Вставьте этот файл в Supabase → SQL Editor → Run

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
