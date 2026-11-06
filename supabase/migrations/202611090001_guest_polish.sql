-- Guest polish: a landscape slot and an optional portrait slot, the frame used
-- at capture, and live print-job updates.
-- The realtime statement from 202611080001_print_jobs_realtime.sql is here.
-- That file is removed. Do not run it as well.
-- No rows. No role changes.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'print_jobs'
  ) then
    alter publication supabase_realtime add table public.print_jobs;
  end if;
end $$;

alter table public.events
  add column frame_portrait_id uuid references public.frames (id);

alter table public.print_jobs
  add column frame_id uuid references public.frames (id);

create function public.frame_is_live_ready(p_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.frames
    where id = p_id
      and is_published is true
      and is_template is not true
  );
$$;

revoke all on function public.frame_is_live_ready(uuid) from public, anon, authenticated;

create or replace function public.events_require_published_frame()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from 'live' then
    return new;
  end if;
  if new.frame_id is not null and not public.frame_is_live_ready(new.frame_id) then
    raise exception 'event_frame_not_published';
  end if;
  if new.frame_portrait_id is not null and not public.frame_is_live_ready(new.frame_portrait_id) then
    raise exception 'event_frame_not_published';
  end if;
  if not public.frame_is_live_ready(new.frame_id)
     and not public.frame_is_live_ready(new.frame_portrait_id) then
    raise exception 'event_frame_not_published';
  end if;
  return new;
end;
$$;

create or replace function public.frames_reject_unpublish_while_live()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.events
      where status = 'live'
        and (frame_id = old.id or frame_portrait_id = old.id)
    ) then
      raise exception 'event_frame_not_published';
    end if;
    return old;
  end if;
  if old.is_published is true and new.is_published is not true and exists (
    select 1 from public.events
    where status = 'live'
      and (frame_id = old.id or frame_portrait_id = old.id)
  ) then
    raise exception 'event_frame_not_published';
  end if;
  return new;
end;
$$;

create or replace function public.frames_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_template is true and exists (
    select 1 from public.events
    where frame_id = old.id or frame_portrait_id = old.id
  ) then
    raise exception 'template_in_use';
  end if;
  new.created_at := old.created_at;
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.events_reject_template_frame()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.frames
    where id in (new.frame_id, new.frame_portrait_id)
      and is_template is true
  ) then
    raise exception 'event_frame_is_template';
  end if;
  return new;
end;
$$;

drop trigger events_reject_template_frame on public.events;

create trigger events_reject_template_frame
before insert or update of frame_id, frame_portrait_id on public.events
for each row execute function public.events_reject_template_frame();

drop function public.create_guest_print(uuid, text, integer);

create function public.create_guest_print(
  p_event_id uuid,
  p_storage_path text,
  p_copies integer,
  p_frame_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest uuid;
  v_photo uuid;
  v_job uuid;
begin
  v_guest := auth.uid();
  if v_guest is null then
    raise exception 'not_authenticated'
      using errcode = 'P0001';
  end if;

  if p_copies is null or p_copies < 1 or p_copies > 20 then
    raise exception 'invalid_copies'
      using errcode = 'P0001';
  end if;

  if p_storage_path is null or pg_catalog.btrim(p_storage_path) = '' then
    raise exception 'invalid_storage_path'
      using errcode = 'P0001';
  end if;

  if not starts_with(p_storage_path, p_event_id::text || '/' || v_guest::text || '/') then
    raise exception 'invalid_storage_path'
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'event_not_found'
      using errcode = 'P0001';
  end if;

  if not public.event_is_live(p_event_id) then
    raise exception 'event_not_live'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.events as e
    join public.frames as f on f.id = p_frame_id
    where e.id = p_event_id
      and f.is_published is true
      and f.is_template is not true
      and (e.frame_id = p_frame_id or e.frame_portrait_id = p_frame_id)
  ) then
    raise exception 'frame_not_in_event'
      using errcode = 'P0001';
  end if;

  insert into public.guest_photos (event_id, guest_id, storage_path)
  values (p_event_id, v_guest, p_storage_path)
  returning id into v_photo;

  insert into public.print_jobs (event_id, photo_id, guest_id, copies, frame_id)
  values (p_event_id, v_photo, v_guest, p_copies, p_frame_id)
  returning id into v_job;

  return v_job;
end;
$$;

revoke all on function public.create_guest_print(uuid, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.create_guest_print(uuid, text, integer, uuid) to authenticated;
revoke execute on function public.create_guest_print(uuid, text, integer, uuid) from service_role;

drop view public.event_cards;

create view public.event_cards
with (security_barrier = true, security_invoker = false) as
select
  id,
  slug,
  title,
  event_date,
  place,
  frame_id,
  frame_portrait_id,
  print_quota,
  status,
  case when status = 'live' then cover_path else null end as cover_path,
  case
    when status = 'live' and public.frame_is_live_ready(frame_id)
      then 'frames/' || frame_id::text || '/screen.webp'
    else null
  end as screen_path,
  case
    when status = 'live' and public.frame_is_live_ready(frame_portrait_id)
      then 'frames/' || frame_portrait_id::text || '/screen.webp'
    else null
  end as screen_path_portrait
from public.events
where status in ('live', 'closed');

grant select on table public.event_cards to anon, authenticated;

commit;
