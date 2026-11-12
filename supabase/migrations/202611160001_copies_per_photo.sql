-- Part 2: copies per photo.
--
-- 1. events.max_copies: how many magnets a guest may order from one photo,
--    1 to 5, set by the admin. Default 1, so every existing event behaves
--    exactly as before (one magnet per photo).
-- 2. The per-guest quota (events.print_quota) now counts photos: one print
--    job per photo, whatever its copies. Every existing job has 1 copy, so
--    every guest's count stays the same.
-- 3. The quota trigger also refuses more copies than the event allows
--    ('too_many_copies'), for every insert, not only through the app.
-- 4. The guest's event card returns max_copies, for the copies stepper.
--
-- Locks: unchanged. The trigger keeps the same per-guest advisory lock and
-- only adds a read of the event row it already reads. create_guest_print is
-- unchanged: a retry of the same photo returns the existing magnet with its
-- first number of copies.
-- Requires 202611150001_event_target_and_close (the event_cards view below
-- keeps its closed-event screen images). No RLS change. No rows changed.

begin;

alter table public.events
  add column max_copies integer not null default 1
    constraint events_max_copies_range check (max_copies between 1 and 5);

comment on column public.events.max_copies is
  'Most magnets a guest may order from one photo (1 = no copies). print_quota counts photos.';

create or replace function public.enforce_print_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quota integer;
  v_max_copies integer;
  v_used integer;
begin
  -- One lock per guest per event. Re-entrant: create_guest_print already
  -- holds it. Released at commit or rollback.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('print_jobs:' || new.event_id::text || ':' || new.guest_id::text, 0)
  );

  select print_quota, max_copies
    into v_quota, v_max_copies
  from public.events
  where id = new.event_id;

  if v_quota is null then
    raise exception 'event_not_found'
      using errcode = 'P0001';
  end if;

  if new.copies > v_max_copies then
    raise exception 'too_many_copies'
      using errcode = 'P0001';
  end if;

  -- The quota counts photos: one job per photo, rejected ones not counted.
  select count(*)
    into v_used
  from public.print_jobs
  where event_id = new.event_id
    and guest_id = new.guest_id
    and status <> 'rejected';

  if v_used + 1 > v_quota then
    raise exception 'print_quota_exceeded'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Same columns, options and grants as before, plus max_copies at the end.
create or replace view public.event_cards
  with (security_barrier = true, security_invoker = false)
as
  select
    events.id,
    events.slug,
    events.title,
    events.event_date,
    events.place,
    events.frame_id,
    events.frame_portrait_id,
    events.print_quota,
    events.status,
    case
      when events.status = 'live' then events.cover_path
      else null::text
    end as cover_path,
    case
      when events.status in ('live', 'closed') and public.frame_is_live_ready(events.frame_id)
        then ('frames/' || events.frame_id::text) || '/screen.webp'
      else null::text
    end as screen_path,
    case
      when events.status in ('live', 'closed') and public.frame_is_live_ready(events.frame_portrait_id)
        then ('frames/' || events.frame_portrait_id::text) || '/screen.webp'
      else null::text
    end as screen_path_portrait,
    events.max_copies
  from public.events
  where events.status in ('live', 'closed');

-- The returned columns change, so the function is dropped and made again with
-- the same body, plus max_copies, and the same grants.
drop function public.get_event_card(text);

create function public.get_event_card(p_slug text)
returns table (
  id uuid,
  slug text,
  title text,
  event_date date,
  place text,
  frame_id uuid,
  frame_portrait_id uuid,
  print_quota integer,
  status text,
  cover_path text,
  screen_path text,
  screen_path_portrait text,
  max_copies integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.slug,
    c.title,
    c.event_date,
    c.place,
    c.frame_id,
    c.frame_portrait_id,
    c.print_quota,
    c.status,
    c.cover_path,
    c.screen_path,
    c.screen_path_portrait,
    c.max_copies
  from public.event_cards as c
  where c.slug = p_slug
  limit 1;
$$;

revoke all on function public.get_event_card(text) from public;
grant execute on function public.get_event_card(text) to anon, authenticated;

commit;
