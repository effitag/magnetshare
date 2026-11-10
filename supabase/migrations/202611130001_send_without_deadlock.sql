-- Guest send without deadlock, idempotent, own folder only.
--
-- 1. Deadlock. The quota trigger used to lock the event row FOR UPDATE. By
--    then the same transaction already held a KEY SHARE lock on that row (the
--    guest_photos foreign key), so two guests sending to the same event at
--    the same moment each waited for the other: a deadlock. The trigger now
--    takes one transaction advisory lock per guest per event and never locks
--    the event row. Sends from different guests no longer wait for each
--    other. Sends from the same guest wait their turn, so the quota still
--    holds.
--
-- 2. Idempotent send. create_guest_print takes the same per-guest lock first,
--    then looks for a photo the guest already sent with this storage path.
--    If one exists, it returns that photo's magnet and creates nothing new.
--    A retry of the same send therefore never makes a second magnet and is
--    not charged against the quota. The app uses one fixed path per captured
--    photo.
--
-- 3. Own folder. The photo path must be exactly
--    <event id>/<calling guest id>/<file name>. A path outside the calling
--    guest's folder for this event raises storage_path_not_yours. The
--    thumbnail sits next to the photo with the same name prefix, so it is
--    in the same folder.
--
-- Same function signatures, grants and trigger. No table changes. No rows.
--
-- Exception messages the app maps to Hebrew:
--   print_quota_exceeded, event_not_found, event_not_live, invalid_copies,
--   invalid_storage_path, storage_path_not_yours, not_authenticated,
--   frame_not_in_event

begin;

create or replace function public.enforce_print_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quota integer;
  v_used integer;
begin
  -- One lock per guest per event. Re-entrant: create_guest_print already
  -- holds it. Released at commit or rollback.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('print_jobs:' || new.event_id::text || ':' || new.guest_id::text, 0)
  );

  select print_quota
    into v_quota
  from public.events
  where id = new.event_id;

  if v_quota is null then
    raise exception 'event_not_found'
      using errcode = 'P0001';
  end if;

  select coalesce(sum(copies), 0)
    into v_used
  from public.print_jobs
  where event_id = new.event_id
    and guest_id = new.guest_id
    and status <> 'rejected';

  if v_used + new.copies > v_quota then
    raise exception 'print_quota_exceeded'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_print_quota() from public, anon, authenticated;

create or replace function public.create_guest_print(
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
  v_folder text;
  v_name text;
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

  if p_event_id is null or p_storage_path is null or pg_catalog.btrim(p_storage_path) = '' then
    raise exception 'invalid_storage_path'
      using errcode = 'P0001';
  end if;

  -- Exactly <event id>/<calling guest id>/<file name>: no other folder, no
  -- sub-folder, no "..".
  v_folder := p_event_id::text || '/' || v_guest::text || '/';
  v_name := pg_catalog.substr(p_storage_path, pg_catalog.length(v_folder) + 1);
  if not starts_with(p_storage_path, v_folder)
    or pg_catalog.strpos(v_name, '/') > 0
    or pg_catalog.strpos(v_name, '..') > 0 then
    raise exception 'storage_path_not_yours'
      using errcode = 'P0001';
  end if;

  if v_name !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$' then
    raise exception 'invalid_storage_path'
      using errcode = 'P0001';
  end if;

  -- Sends from the same guest to the same event run one at a time. Sends from
  -- other guests do not wait.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('print_jobs:' || p_event_id::text || ':' || v_guest::text, 0)
  );

  -- A retry of a send that already went through: return the same magnet.
  select gp.id
    into v_photo
  from public.guest_photos as gp
  where gp.storage_path = p_storage_path
    and gp.guest_id = v_guest
    and gp.event_id = p_event_id;

  if v_photo is not null then
    select pj.id
      into v_job
    from public.print_jobs as pj
    where pj.photo_id = v_photo;

    if v_job is not null then
      return v_job;
    end if;
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

  if v_photo is null then
    insert into public.guest_photos (event_id, guest_id, storage_path)
    values (p_event_id, v_guest, p_storage_path)
    returning id into v_photo;
  end if;

  insert into public.print_jobs (event_id, photo_id, guest_id, copies, frame_id)
  values (p_event_id, v_photo, v_guest, p_copies, p_frame_id)
  returning id into v_job;

  return v_job;
end;
$$;

revoke all on function public.create_guest_print(uuid, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.create_guest_print(uuid, text, integer, uuid) to authenticated;
revoke execute on function public.create_guest_print(uuid, text, integer, uuid) from service_role;

commit;
