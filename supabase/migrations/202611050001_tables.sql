-- MagnetimShare development tables and constraints.
-- No rows. No role changes. No changes to auth.users.

begin;

create table public.admin_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'pending' check (role in ('pending', 'admin')),
  created_at timestamptz not null default now(),
  constraint admin_profiles_email_unique unique (email)
);

create table public.signin_allowlist (
  email text primary key check (position('@' in email) > 1),
  created_at timestamptz not null default now()
);

create table public.frames (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  width_mm integer not null check (width_mm > 0),
  height_mm integer not null check (height_mm > 0),
  overlay_path text,
  window_x numeric(5, 4) not null check (window_x >= 0 and window_x <= 1),
  window_y numeric(5, 4) not null check (window_y >= 0 and window_y <= 1),
  window_w numeric(5, 4) not null check (window_w > 0 and window_w <= 1),
  window_h numeric(5, 4) not null check (window_h > 0 and window_h <= 1),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint frames_window_inside check (
    window_x + window_w <= 1 and window_y + window_h <= 1
  )
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organizer_name text not null,
  phone text not null,
  event_name text not null,
  event_date date,
  place text,
  guest_count_range text,
  frame_id uuid references public.frames (id),
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'closed')),
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  event_date date,
  place text,
  frame_id uuid not null references public.frames (id),
  print_quota integer not null check (print_quota > 0),
  status text not null default 'draft' check (status in ('draft', 'live', 'closed')),
  lead_id uuid references public.leads (id),
  created_at timestamptz not null default now(),
  constraint events_slug_unique unique (slug),
  constraint events_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.guest_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  guest_id uuid not null references auth.users (id),
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint guest_photos_path_unique unique (storage_path)
);

create table public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  photo_id uuid not null references public.guest_photos (id),
  guest_id uuid not null references auth.users (id),
  copies integer not null check (copies between 1 and 20),
  status text not null default 'queued' check (
    status in ('queued', 'printing', 'ready', 'delivered', 'rejected')
  ),
  created_at timestamptz not null default now(),
  constraint print_jobs_one_per_photo unique (photo_id)
);

create index print_jobs_guest_quota_idx
  on public.print_jobs (event_id, guest_id)
  where status <> 'rejected';

alter table public.admin_profiles enable row level security;
alter table public.signin_allowlist enable row level security;
alter table public.frames enable row level security;
alter table public.leads enable row level security;
alter table public.events enable row level security;
alter table public.guest_photos enable row level security;
alter table public.print_jobs enable row level security;

commit;
