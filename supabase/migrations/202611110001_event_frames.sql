-- Event type, and event frames that belong to one event.
--
-- events.event_type   filters the template gallery (null until chosen).
-- frames.event_id     the event an event frame belongs to. Templates have none.
-- frames.source_template_id  the template the event frame was copied from.
--
-- A frame that magnets were sent with never changes: its design, size, photo
-- window, files and event stay as they were, so every magnet prints with the
-- frame it was shot in. Any change makes a new copy.
--
-- attach_event_frame() puts a ready event frame into an event slot in one
-- step. It replaces the "assign" and "publish" steps. On request it also moves
-- the event's queued (not yet printed) magnets from the old frame to the new one.
--
-- Backfills event_id on existing event frames. No other rows. No role changes.

begin;

alter table public.events
  add column event_type text;

alter table public.events
  add constraint events_event_type_check check (
    event_type is null
    or event_type in ('wedding', 'henna', 'mitzvah', 'brit', 'birthday', 'general', 'company')
  );

alter table public.frames
  add column source_template_id uuid references public.frames (id) on delete set null,
  add column event_id uuid references public.events (id) on delete set null;

alter table public.frames
  add constraint frames_template_has_no_event check (is_template is not true or event_id is null);

create index frames_event_id_idx on public.frames (event_id) where event_id is not null;

-- Existing event frames: the event that shows them now, else the event of
-- their first print job.
update public.frames as f
set event_id = e.id
from public.events as e
where f.is_template is not true
  and f.event_id is null
  and (e.frame_id = f.id or e.frame_portrait_id = f.id);

update public.frames as f
set event_id = p.event_id
from (
  select distinct on (frame_id) frame_id, event_id
  from public.print_jobs
  where frame_id is not null
  order by frame_id, created_at
) as p
where f.id = p.frame_id
  and f.is_template is not true
  and f.event_id is null;

-- A frame is used once a magnet was sent with it.
create function public.frame_is_used(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.print_jobs where frame_id = p_id);
$$;

revoke all on function public.frame_is_used(uuid) from public, anon;
grant execute on function public.frame_is_used(uuid) to authenticated;

create function public.frames_freeze_when_used()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.frame_is_used(old.id) and (
    new.design is distinct from old.design
    or new.width_mm is distinct from old.width_mm
    or new.height_mm is distinct from old.height_mm
    or new.bleed_mm is distinct from old.bleed_mm
    or new.safe_mm is distinct from old.safe_mm
    or new.window_x is distinct from old.window_x
    or new.window_y is distinct from old.window_y
    or new.window_w is distinct from old.window_w
    or new.window_h is distinct from old.window_h
    or new.overlay_path is distinct from old.overlay_path
    or new.is_template is distinct from old.is_template
    or new.event_id is distinct from old.event_id
    or (old.is_published is true and new.is_published is not true)
  ) then
    raise exception 'frame_in_use'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.frames_freeze_when_used() from public, anon, authenticated;

create trigger frames_freeze_when_used
before update on public.frames
for each row execute function public.frames_freeze_when_used();

-- The files of a used frame cannot be replaced or deleted either.
create function public.frame_asset_is_used(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.print_jobs as p
    where (storage.foldername(p_name))[1] = 'frames'
      and p.frame_id::text = (storage.foldername(p_name))[2]
  );
$$;

revoke all on function public.frame_asset_is_used(text) from public, anon;
grant execute on function public.frame_asset_is_used(text) to authenticated;

drop policy media_update_frames_admin on storage.objects;

create policy media_update_frames_admin
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'frames'
    and (select public.is_admin())
    and not (select public.frame_asset_is_used(name))
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'frames'
    and (select public.is_admin())
    and not (select public.frame_asset_is_used(name))
  );

drop policy media_delete_frames_admin on storage.objects;

create policy media_delete_frames_admin
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'frames'
    and (select public.is_admin())
    and not (select public.frame_asset_is_used(name))
  );

-- Puts a ready event frame into an event slot. Returns how many queued
-- magnets moved to it (0 unless p_move_queued).
-- Exception messages the app maps to Hebrew:
--   not_admin, invalid_slot, frame_not_found, event_frame_is_template,
--   frame_of_other_event, frame_wrong_orientation, frame_files_missing,
--   event_not_found
create function public.attach_event_frame(
  p_event_id uuid,
  p_slot text,
  p_frame_id uuid,
  p_move_queued boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_frame record;
  v_event record;
  v_old uuid;
  v_moved integer := 0;
  v_folder text := 'frames/' || p_frame_id::text || '/';
begin
  if not public.is_admin() then
    raise exception 'not_admin'
      using errcode = 'P0001';
  end if;

  if p_slot is null or p_slot not in ('landscape', 'portrait') then
    raise exception 'invalid_slot'
      using errcode = 'P0001';
  end if;

  select id, is_template, event_id, width_mm, height_mm
    into v_frame
  from public.frames
  where id = p_frame_id
  for update;

  if not found then
    raise exception 'frame_not_found'
      using errcode = 'P0001';
  end if;

  if v_frame.is_template is true then
    raise exception 'event_frame_is_template'
      using errcode = 'P0001';
  end if;

  if v_frame.event_id is not null and v_frame.event_id <> p_event_id then
    raise exception 'frame_of_other_event'
      using errcode = 'P0001';
  end if;

  -- Same rule as the app: wider than tall is landscape, anything else portrait.
  if (case when v_frame.width_mm > v_frame.height_mm then 'landscape' else 'portrait' end) <> p_slot then
    raise exception 'frame_wrong_orientation'
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from storage.objects where bucket_id = 'media' and name = v_folder || 'overlay.png')
     or not exists (select 1 from storage.objects where bucket_id = 'media' and name = v_folder || 'screen.webp') then
    raise exception 'frame_files_missing'
      using errcode = 'P0001';
  end if;

  select id, frame_id, frame_portrait_id
    into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'event_not_found'
      using errcode = 'P0001';
  end if;

  v_old := case when p_slot = 'landscape' then v_event.frame_id else v_event.frame_portrait_id end;

  update public.frames
  set is_published = true,
      event_id = p_event_id,
      overlay_path = v_folder || 'overlay.png',
      preview_path = v_folder || 'preview.png'
  where id = p_frame_id;

  if p_slot = 'landscape' then
    update public.events set frame_id = p_frame_id where id = p_event_id;
  else
    update public.events set frame_portrait_id = p_frame_id where id = p_event_id;
  end if;

  if p_move_queued and v_old is not null and v_old <> p_frame_id then
    update public.print_jobs
    set frame_id = p_frame_id
    where event_id = p_event_id
      and frame_id = v_old
      and status = 'queued';
    get diagnostics v_moved = row_count;
  end if;

  return v_moved;
end;
$$;

revoke all on function public.attach_event_frame(uuid, text, uuid, boolean) from public, anon;
grant execute on function public.attach_event_frame(uuid, text, uuid, boolean) to authenticated;

commit;
