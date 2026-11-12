create table if not exists public.site_content (
  id smallint primary key check (id = 1),
  data jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.site_content enable row level security;
alter table public.site_admins enable row level security;

revoke all on table public.site_content from anon, authenticated;
grant select on table public.site_content to anon, authenticated;
grant update on table public.site_content to authenticated;

revoke all on table public.site_admins from anon, authenticated;
grant select on table public.site_admins to authenticated;

drop policy if exists "Public can read site content" on public.site_content;
create policy "Public can read site content"
  on public.site_content for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can update site content" on public.site_content;
create policy "Admins can update site content"
  on public.site_content for update
  to authenticated
  using (exists (
    select 1 from public.site_admins a
    where a.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.site_admins a
    where a.user_id = (select auth.uid())
  ));

drop policy if exists "Admins can read their own admin record" on public.site_admins;
create policy "Admins can read their own admin record"
  on public.site_admins for select
  to authenticated
  using (user_id = (select auth.uid()));

insert into public.site_content (id, data)
values (1, null)
on conflict (id) do nothing;

create or replace function public.set_site_content_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_site_content_updated_at on public.site_content;
create trigger set_site_content_updated_at
  before update on public.site_content
  for each row execute function public.set_site_content_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload property photos" on storage.objects;
create policy "Admins can upload property photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'property-photos'
    and exists (
      select 1 from public.site_admins a
      where a.user_id = (select auth.uid())
    )
  );
