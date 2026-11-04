-- MemoriaShare / Magnetim Phase 1
-- Run once in the Supabase SQL editor. Re-running is safe.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'organizer' check (role in ('organizer', 'operator')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text not null default '',
  event_date date,
  cover_path text,
  type text not null check (type in ('share', 'magnet')),
  public_slug text not null unique,
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  moderation_required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  storage_path text not null unique,
  uploader_name text,
  status text not null check (status in ('pending', 'approved', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.frames (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  template_key text not null,
  logo_path text,
  title_text text not null default '',
  date_text text not null default '',
  colors jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.print_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  photo_id uuid not null references public.photos (id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'new'
    check (status in ('new', 'printing', 'ready', 'delivered', 'cancelled')),
  guest_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_owner_idx on public.events (owner_id);
create index if not exists photos_event_status_idx on public.photos (event_id, status, created_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), '') <> 'service_role' then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.photos enable row level security;
alter table public.frames enable row level security;
alter table public.print_orders enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.profiles to anon;
grant select, insert, update, delete on public.events to anon, authenticated;
grant select, insert, update, delete on public.photos to anon, authenticated;
grant select, insert, update, delete on public.frames to authenticated;
grant select, insert, update, delete on public.print_orders to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists events_owner_all on public.events;
create policy events_owner_all on public.events
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select to anon, authenticated
  using (status in ('active', 'closed'));

drop policy if exists photos_public_read on public.photos;
create policy photos_public_read on public.photos
  for select to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.events e
      where e.id = photos.event_id and e.status in ('active', 'closed')
    )
  );

drop policy if exists photos_owner_read on public.photos;
create policy photos_owner_read on public.photos
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = photos.event_id and e.owner_id = auth.uid()
    )
  );

drop policy if exists photos_insert_gated on public.photos;
create policy photos_insert_gated on public.photos
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and e.status = 'active'
        and (
          (e.owner_id = auth.uid())
          or (e.moderation_required and status = 'pending')
          or (not e.moderation_required and status = 'approved')
        )
    )
  );

drop policy if exists photos_owner_update on public.photos;
create policy photos_owner_update on public.photos
  for update to authenticated
  using (
    exists (select 1 from public.events e where e.id = photos.event_id and e.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.events e where e.id = photos.event_id and e.owner_id = auth.uid())
  );

drop policy if exists photos_owner_delete on public.photos;
create policy photos_owner_delete on public.photos
  for delete to authenticated
  using (
    exists (select 1 from public.events e where e.id = photos.event_id and e.owner_id = auth.uid())
  );

drop policy if exists frames_owner_all on public.frames;
create policy frames_owner_all on public.frames
  for all to authenticated
  using (
    exists (select 1 from public.events e where e.id = frames.event_id and e.owner_id = auth.uid())
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = frames.event_id and e.owner_id = auth.uid() and e.type = 'magnet'
    )
  );

drop policy if exists orders_owner_read on public.print_orders;
create policy orders_owner_read on public.print_orders
  for select to authenticated
  using (
    exists (select 1 from public.events e where e.id = print_orders.event_id and e.owner_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'operator')
  );

drop policy if exists orders_operator_update on public.print_orders;
create policy orders_operator_update on public.print_orders
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'operator'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'operator'));

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

drop policy if exists media_owner_write on storage.objects;
create policy media_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and exists (
      select 1 from public.events e
      where e.owner_id = auth.uid()
        and e.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'media'
    and (
      exists (
        select 1 from public.photos p
        join public.events e on e.id = p.event_id
        where p.storage_path = name
          and p.status = 'approved'
          and e.status in ('active', 'closed')
      )
      or exists (
        select 1 from public.events e
        where e.cover_path = name
          and (e.status in ('active', 'closed') or e.owner_id = auth.uid())
      )
      or exists (
        select 1 from public.events e
        where e.owner_id = auth.uid()
          and e.id::text = (storage.foldername(name))[1]
      )
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.photos;
exception
  when duplicate_object then null;
end $$;
