-- No magnet without its photo.
--
-- create_guest_print now refuses to create a new magnet when the photo file is
-- not in the media bucket (photo_not_uploaded). Before, a magnet could reach
-- the print queue with no photo to print. The app uploads the photo and the
-- thumbnail first, and on photo_not_uploaded it uploads again and retries.
--
-- A retry of a send that is already stored still returns the same magnet
-- first, before this check. Everything else is unchanged from
-- 202611130001_send_without_deadlock: same signature, grants, per-guest lock,
-- own-folder rule and error codes. No table changes. No rows.
--
-- Exception messages the app maps to Hebrew:
--   print_quota_exceeded, event_not_found, event_not_live, invalid_copies,
--   invalid_storage_path, storage_path_not_yours, not_authenticated,
--   frame_not_in_event, photo_not_uploaded

begin;

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

  -- The print station needs the photo: no new magnet without its file in
  -- Storage. The app uploads the photo first; if it is missing, the app
  -- uploads it again and retries.
  if not exists (
    select 1
    from storage.objects as o
    where o.bucket_id = 'media'
      and o.name = p_storage_path
  ) then
    raise exception 'photo_not_uploaded'
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
