-- MagnetimShare guest print function and quota trigger.
-- is_admin() and event_is_live() already exist. They are not redefined here.
-- No rows. No role changes. No changes to auth.users.
--
-- Exception messages the app can map to Hebrew:
--   print_quota_exceeded, event_not_found, event_not_live,
--   invalid_copies, invalid_storage_path, not_authenticated

begin;

-- The event row lock serializes quota checks for all guests of the same event.
-- That is intended. It is a simple lock on one row, and it is acceptable at this scale.
create function public.enforce_print_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quota integer;
  v_used integer;
begin
  select print_quota
    into v_quota
  from public.events
  where id = new.event_id
  for update;

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

create trigger print_jobs_enforce_quota
  before insert on public.print_jobs
  for each row
  execute function public.enforce_print_quota();

create function public.create_guest_print(
  p_event_id uuid,
  p_storage_path text,
  p_copies integer
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

  if not public.event_is_live(p_event_id) then
    raise exception 'event_not_live'
      using errcode = 'P0001';
  end if;

  insert into public.guest_photos (event_id, guest_id, storage_path)
  values (p_event_id, v_guest, p_storage_path)
  returning id into v_photo;

  insert into public.print_jobs (event_id, photo_id, guest_id, copies)
  values (p_event_id, v_photo, v_guest, p_copies)
  returning id into v_job;

  return v_job;
end;
$$;

revoke all on function public.create_guest_print(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.create_guest_print(uuid, text, integer) to authenticated;
revoke execute on function public.create_guest_print(uuid, text, integer) from service_role;

commit;
