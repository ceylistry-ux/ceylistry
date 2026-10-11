-- Ceylistry discovery marketplace: first database foundation.
-- Public listing access is moderated; visitor enquiry data stays in a private schema.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 100),
  location text not null default '' check (char_length(location) <= 120),
  bio text not null default '' check (char_length(bio) <= 2000),
  portrait_path text,
  discipline text not null default '' check (char_length(discipline) <= 100),
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  category text not null check (category in ('Illustrations','Paintings','Prints','Original art','Commissions')),
  type text not null check (type in ('Original','Print','Digital')),
  price_lkr numeric(12,2) not null check (price_lkr > 0),
  image_path text not null,
  description text not null default '' check (char_length(description) <= 4000),
  medium text not null default '' check (char_length(medium) <= 160),
  dimensions text not null default '' check (char_length(dimensions) <= 120),
  commission boolean not null default false,
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index artworks_artist_id_idx on public.artworks (artist_id);
create index artworks_discovery_idx on public.artworks (status, category, created_at desc);
create index artists_discovery_idx on public.artists (status, featured desc, name);

create table private.enquiries (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid references public.artworks(id) on delete set null,
  artist_id uuid not null references public.artists(id) on delete cascade,
  visitor_name text not null check (char_length(visitor_name) between 1 and 120),
  visitor_email text not null check (char_length(visitor_email) between 3 and 254),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new','read','closed')),
  created_at timestamptz not null default now()
);
alter table private.enquiries enable row level security;
grant select, insert, update, delete on private.enquiries to service_role;
create function private.guard_artist_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if new.user_id is distinct from old.user_id or new.featured is distinct from old.featured then
      raise exception 'Artist ownership and featured status cannot be changed by the artist';
    end if;
    if new.status is distinct from old.status
       and not (old.status in ('draft','rejected') and new.status = 'pending') then
      new.status := old.status;
    end if;
    if old.status = 'approved' and row(new.slug,new.name,new.location,new.bio,new.portrait_path,new.discipline)
       is distinct from row(old.slug,old.name,old.location,old.bio,old.portrait_path,old.discipline) then
      new.status := 'pending';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create function private.guard_artwork_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if new.status is distinct from old.status
       and not (old.status in ('draft','rejected') and new.status = 'pending') then
      new.status := old.status;
    end if;
    if old.status = 'approved' and row(new.artist_id,new.slug,new.title,new.category,new.type,new.price_lkr,new.image_path,new.description,new.medium,new.dimensions,new.commission)
       is distinct from row(old.artist_id,old.slug,old.title,old.category,old.type,old.price_lkr,old.image_path,old.description,old.medium,old.dimensions,old.commission) then
      new.status := 'pending';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger artists_guard_update before update on public.artists
for each row execute function private.guard_artist_update();
create trigger artworks_guard_update before update on public.artworks
for each row execute function private.guard_artwork_update();

revoke all on function private.guard_artist_update() from public, anon, authenticated;
revoke all on function private.guard_artwork_update() from public, anon, authenticated;

alter table public.artists enable row level security;
alter table public.artworks enable row level security;

create policy "Approved artist profiles are public"
on public.artists for select to anon using (status = 'approved');
create policy "Artists see approved profiles and their own profile"
on public.artists for select to authenticated
using (status = 'approved' or user_id = (select auth.uid()));
create policy "Artists create their own draft profile"
on public.artists for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'draft');
create policy "Artists update their own profile"
on public.artists for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy "Artists delete their own draft or rejected profile"
on public.artists for delete to authenticated
using (user_id = (select auth.uid()) and status in ('draft','rejected'));

create policy "Approved artwork from approved artists is public"
on public.artworks for select to anon
using (status = 'approved' and exists (
  select 1 from public.artists a where a.id = artist_id and a.status = 'approved'
));
create policy "Artists see approved artwork and their own listings"
on public.artworks for select to authenticated
using (
  (status = 'approved' and exists (select 1 from public.artists a where a.id = artist_id and a.status = 'approved'))
  or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = (select auth.uid()))
);
create policy "Artists create their own draft listings"
on public.artworks for insert to authenticated
with check (
  status = 'draft'
  and exists (select 1 from public.artists a where a.id = artist_id and a.user_id = (select auth.uid()))
);
create policy "Artists update their own listings"
on public.artworks for update to authenticated
using (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = (select auth.uid())))
with check (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = (select auth.uid())));
create policy "Artists delete their own draft or rejected listings"
on public.artworks for delete to authenticated
using (
  status in ('draft','rejected')
  and exists (select 1 from public.artists a where a.id = artist_id and a.user_id = (select auth.uid()))
);

revoke all on public.artists, public.artworks from public, anon, authenticated;
grant select (id,slug,name,location,bio,portrait_path,discipline,featured,status,created_at,updated_at)
  on public.artists to anon, authenticated;
grant insert (user_id,slug,name,location,bio,portrait_path,discipline)
  on public.artists to authenticated;
grant update (slug,name,location,bio,portrait_path,discipline,status)
  on public.artists to authenticated;
grant delete on public.artists to authenticated;
grant select (id,artist_id,slug,title,category,type,price_lkr,image_path,description,medium,dimensions,commission,status,created_at,updated_at)
  on public.artworks to anon, authenticated;
grant insert (artist_id,slug,title,category,type,price_lkr,image_path,description,medium,dimensions,commission)
  on public.artworks to authenticated;
grant update (slug,title,category,type,price_lkr,image_path,description,medium,dimensions,commission,status)
  on public.artworks to authenticated;
grant delete on public.artworks to authenticated;
grant all on public.artists, public.artworks to service_role;
grant usage on schema public to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artwork-images','artwork-images',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Owners and approved listings can read artwork images"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'artwork-images'
  and (
    ((select auth.uid()) is not null and split_part(name,'/',1) = (select auth.uid())::text)
    or exists (
      select 1 from public.artworks w
      join public.artists a on a.id = w.artist_id
      where w.image_path = storage.objects.name and w.status = 'approved' and a.status = 'approved'
    )
    or exists (
      select 1 from public.artists a
      where a.portrait_path = storage.objects.name and a.status = 'approved'
    )
  )
);
create policy "Artists upload images into their own folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'artwork-images' and split_part(name,'/',1) = (select auth.uid())::text);
create policy "Artists update images in their own folder"
on storage.objects for update to authenticated
using (bucket_id = 'artwork-images' and split_part(name,'/',1) = (select auth.uid())::text)
with check (bucket_id = 'artwork-images' and split_part(name,'/',1) = (select auth.uid())::text);
create policy "Artists delete images in their own folder"
on storage.objects for delete to authenticated
using (bucket_id = 'artwork-images' and split_part(name,'/',1) = (select auth.uid())::text);

