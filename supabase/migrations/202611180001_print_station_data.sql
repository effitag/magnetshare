-- Print station, database layer (PR A). No screens yet.
--
-- 1. Operators: a new role, 'operator', in admin_profiles, and event_operators
--    (which operator works which event). An operator can print and change
--    statuses for their events only; an admin can do it for every event, as
--    a backup. Operators cannot edit events, frames or the allowlist.
-- 2. print_runs: one row per physical print (copies 1-5, first print or
--    reprint, station, printer, operator, sent / printed / failed /
--    released). The operator decides the copies at print time. Guests cannot
--    read this table, and their quota never counts it.
-- 3. print_job_events: the status history of every magnet (from, to, reason,
--    run, who, when). Rejection reasons live here. Guests cannot read it.
-- 4. Status changes only through checked functions: start_print,
--    release_print, confirm_print, mark_delivered, reject_job, and
--    reopen_job (admin only). Each checks the caller may operate the event
--    and that the change is valid, locks the magnet, and writes the history.
--    Nobody updates print_jobs directly any more.
-- 5. print_jobs.copies is frozen at 1 (check constraint, and no update
--    grant): it is the guest's photo, and the quota keeps counting photos.
-- 6. Operators can read their events, the frames those events use, their
--    magnets and photo rows, and the photo and frame files in Storage.
-- 7. event_magnet_counts counts physical magnets (printed copies of first
--    prints, or 1 for a magnet not printed yet), for admins and for the
--    operators of each event.
--
-- No row of an existing table changes. Guests are not affected: the send
-- function, its lock and the guest's reads are unchanged.

begin;

-- 1. Operators ---------------------------------------------------------------

alter table public.admin_profiles drop constraint admin_profiles_role_check;
alter table public.admin_profiles
  add constraint admin_profiles_role_check check (role in ('pending', 'admin', 'operator'));

create table public.event_operators (
  event_id uuid not null references public.events (id) on delete cascade,
  operator_id uuid not null references public.admin_profiles (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (event_id, operator_id)
);

create index event_operators_operator_idx on public.event_operators (operator_id);

alter table public.event_operators enable row level security;

create function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = (select auth.uid())
      and role = 'operator'
  );
$$;

-- An admin may operate every event; an operator only the events assigned to them.
create function public.can_operate_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.event_operators as eo
      join public.admin_profiles as ap on ap.id = eo.operator_id
      where eo.event_id = p_event_id
        and eo.operator_id = (select auth.uid())
        and ap.role = 'operator'
    );
$$;

-- Frames an operator needs: the ones their events use now, and the ones
-- their events' magnets were taken in.
create function public.operator_can_see_frame(p_frame_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1
      from public.events as e
      where (e.frame_id = p_frame_id or e.frame_portrait_id = p_frame_id)
        and public.can_operate_event(e.id)
    )
    or exists (
      select 1
      from public.print_jobs as pj
      where pj.frame_id = p_frame_id
        and public.can_operate_event(pj.event_id)
    );
$$;

-- Storage objects an operator may read: photos under <event id>/ of their
-- events, and the files under frames/<frame id>/ of frames they need.
create function public.operator_can_read_media(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := storage.foldername(p_name);
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if v_parts[1] = 'frames' then
    return v_parts[2] ~ v_uuid and public.operator_can_see_frame(v_parts[2]::uuid);
  end if;
  return v_parts[1] ~ v_uuid and public.can_operate_event(v_parts[1]::uuid);
end;
$$;

revoke all on function public.is_operator() from public, anon;
revoke all on function public.can_operate_event(uuid) from public, anon;
revoke all on function public.operator_can_see_frame(uuid) from public, anon;
revoke all on function public.operator_can_read_media(text) from public, anon;
grant execute on function public.is_operator() to authenticated;
grant execute on function public.can_operate_event(uuid) to authenticated;
grant execute on function public.operator_can_see_frame(uuid) to authenticated;
grant execute on function public.operator_can_read_media(text) to authenticated;

revoke all on table public.event_operators from anon, authenticated;
grant select, insert, delete on table public.event_operators to authenticated;

create policy event_operators_select on public.event_operators
  for select to authenticated
  using ((select public.is_admin()) or operator_id = (select auth.uid()));

create policy event_operators_insert_admin on public.event_operators
  for insert to authenticated
  with check ((select public.is_admin()));

create policy event_operators_delete_admin on public.event_operators
  for delete to authenticated
  using ((select public.is_admin()));

-- 2. print_runs --------------------------------------------------------------

create table public.print_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.print_jobs (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('print', 'reprint')),
  copies integer not null check (copies between 1 and 5),
  status text not null default 'sent' check (status in ('sent', 'printed', 'failed', 'released')),
  station text not null check (char_length(station) between 1 and 40),
  printer text check (printer is null or char_length(printer) between 1 and 40),
  operator_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index print_runs_job_idx on public.print_runs (job_id);
create index print_runs_event_idx on public.print_runs (event_id, created_at);
-- At most one print of a magnet in progress at a time.
create unique index print_runs_one_open_per_job on public.print_runs (job_id) where status = 'sent';

alter table public.print_runs enable row level security;
revoke all on table public.print_runs from anon, authenticated;
grant select on table public.print_runs to authenticated;

create policy print_runs_select_operator on public.print_runs
  for select to authenticated
  using ((select public.can_operate_event(event_id)));

-- 3. print_job_events --------------------------------------------------------

create table public.print_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.print_jobs (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  from_status text not null,
  to_status text not null,
  reason text check (reason in ('inappropriate', 'invalid_photo', 'print_failure')),
  run_id uuid references public.print_runs (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint print_job_events_reason_only_on_reject
    check ((to_status = 'rejected') = (reason is not null))
);

create index print_job_events_job_idx on public.print_job_events (job_id);
create index print_job_events_event_idx on public.print_job_events (event_id, created_at);

alter table public.print_job_events enable row level security;
revoke all on table public.print_job_events from anon, authenticated;
grant select on table public.print_job_events to authenticated;

create policy print_job_events_select_operator on public.print_job_events
  for select to authenticated
  using ((select public.can_operate_event(event_id)));

-- 4 and 5. print_jobs: copies frozen, status changes only through functions --

alter table public.print_jobs add constraint print_jobs_copies_one check (copies = 1);

drop policy print_jobs_update_admin on public.print_jobs;
revoke update on table public.print_jobs from anon, authenticated;
revoke update (copies, status) on table public.print_jobs from anon, authenticated;

-- Locks the magnet and checks the caller may operate its event.
create function public.lock_job_for_operator(p_job_id uuid)
returns public.print_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.print_jobs;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_job from public.print_jobs where id = p_job_id for update;
  if not found then
    raise exception 'job_not_found' using errcode = 'P0001';
  end if;

  if not public.can_operate_event(v_job.event_id) then
    raise exception 'not_operator' using errcode = 'P0001';
  end if;

  return v_job;
end;
$$;

revoke all on function public.lock_job_for_operator(uuid) from public, anon, authenticated;

-- Starts a print. From בתור it moves the magnet to בהדפסה. While בהדפסה (the
-- last print failed) it tries again. When ready, 'print' adds copies and
-- 'reprint' replaces a spoiled print (not counted as a magnet).
-- Returns the print's id.
create function public.start_print(
  p_job_id uuid,
  p_copies integer,
  p_station text,
  p_kind text default 'print',
  p_printer text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.print_jobs;
  v_station text := pg_catalog.btrim(coalesce(p_station, ''));
  v_printer text := nullif(pg_catalog.btrim(coalesce(p_printer, '')), '');
  v_counted integer;
  v_run uuid;
begin
  if p_kind is null or p_kind not in ('print', 'reprint') then
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;
  if p_copies is null or p_copies < 1 or p_copies > 5 then
    raise exception 'invalid_copies' using errcode = 'P0001';
  end if;
  if char_length(v_station) not between 1 and 40 or (v_printer is not null and char_length(v_printer) > 40) then
    raise exception 'invalid_station' using errcode = 'P0001';
  end if;

  v_job := public.lock_job_for_operator(p_job_id);

  if exists (select 1 from public.print_runs where job_id = p_job_id and status = 'sent') then
    raise exception 'print_in_progress' using errcode = 'P0001';
  end if;

  if v_job.status in ('queued', 'printing') and p_kind <> 'print' then
    raise exception 'nothing_to_reprint' using errcode = 'P0001';
  end if;
  if v_job.status not in ('queued', 'printing', 'ready') then
    raise exception 'job_closed' using errcode = 'P0001';
  end if;

  -- At most 5 counted magnets per photo; reprints replace, so they do not count.
  if p_kind = 'print' then
    select coalesce(sum(copies), 0)
      into v_counted
    from public.print_runs
    where job_id = p_job_id
      and kind = 'print'
      and status in ('sent', 'printed');
    if v_counted + p_copies > 5 then
      raise exception 'too_many_copies' using errcode = 'P0001';
    end if;
  end if;

  insert into public.print_runs (job_id, event_id, kind, copies, station, printer, operator_id)
  values (p_job_id, v_job.event_id, p_kind, p_copies, v_station, v_printer, auth.uid())
  returning id into v_run;

  if v_job.status = 'queued' then
    update public.print_jobs set status = 'printing' where id = p_job_id;
    insert into public.print_job_events (job_id, event_id, from_status, to_status, run_id, actor_id)
    values (p_job_id, v_job.event_id, 'queued', 'printing', v_run, auth.uid());
  end if;

  return v_run;
end;
$$;

-- Cancels a print that never reached the printer (for example, writing the
-- print file failed). A first print that had not printed goes back to בתור.
create function public.release_print(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_job public.print_jobs;
  v_run public.print_runs;
begin
  select job_id into v_job_id from public.print_runs where id = p_run_id;
  if v_job_id is null then
    raise exception 'run_not_found' using errcode = 'P0001';
  end if;

  v_job := public.lock_job_for_operator(v_job_id);

  select * into v_run from public.print_runs where id = p_run_id;
  if v_run.status <> 'sent' then
    raise exception 'run_not_open' using errcode = 'P0001';
  end if;

  update public.print_runs set status = 'released', finished_at = now() where id = p_run_id;

  if v_run.kind = 'print'
    and v_job.status = 'printing'
    and not exists (
      select 1 from public.print_runs
      where job_id = v_job_id and kind = 'print' and status = 'printed'
    )
    and not exists (
      select 1 from public.print_runs
      where job_id = v_job_id and status = 'failed'
    ) then
    update public.print_jobs set status = 'queued' where id = v_job_id;
    insert into public.print_job_events (job_id, event_id, from_status, to_status, run_id, actor_id)
    values (v_job_id, v_job.event_id, 'printing', 'queued', p_run_id, auth.uid());
  end if;
end;
$$;

-- The operator's "הודפס" (printed) or "נכשל" (failed). Printed moves a
-- magnet in בהדפסה to מוכן לאיסוף. Failed leaves it for a retry or a rejection.
create function public.confirm_print(p_run_id uuid, p_printed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_job public.print_jobs;
  v_run public.print_runs;
begin
  if p_printed is null then
    raise exception 'invalid_result' using errcode = 'P0001';
  end if;

  select job_id into v_job_id from public.print_runs where id = p_run_id;
  if v_job_id is null then
    raise exception 'run_not_found' using errcode = 'P0001';
  end if;

  v_job := public.lock_job_for_operator(v_job_id);

  select * into v_run from public.print_runs where id = p_run_id;
  if v_run.status <> 'sent' then
    raise exception 'run_not_open' using errcode = 'P0001';
  end if;

  update public.print_runs
  set status = case when p_printed then 'printed' else 'failed' end,
      finished_at = now()
  where id = p_run_id;

  if p_printed and v_job.status = 'printing' then
    update public.print_jobs set status = 'ready' where id = v_job_id;
    insert into public.print_job_events (job_id, event_id, from_status, to_status, run_id, actor_id)
    values (v_job_id, v_job.event_id, 'printing', 'ready', p_run_id, auth.uid());
  end if;
end;
$$;

-- "נמסר" for one or more ready magnets. All or nothing. Returns how many.
create function public.mark_delivered(p_job_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id uuid;
  v_job public.print_jobs;
begin
  select coalesce(array_agg(distinct x order by x), '{}') into v_ids from unnest(p_job_ids) as x where x is not null;

  -- In id order, so two operators delivering overlapping sets cannot deadlock.
  foreach v_id in array v_ids loop
    v_job := public.lock_job_for_operator(v_id);
    if v_job.status <> 'ready' then
      raise exception 'job_not_ready' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.print_runs where job_id = v_id and status = 'sent') then
      raise exception 'print_in_progress' using errcode = 'P0001';
    end if;
    update public.print_jobs set status = 'delivered' where id = v_id;
    insert into public.print_job_events (job_id, event_id, from_status, to_status, actor_id)
    values (v_id, v_job.event_id, 'ready', 'delivered', auth.uid());
  end loop;

  return cardinality(v_ids);
end;
$$;

-- "דחייה" with one of three reasons, from any open status. A print in
-- progress is cancelled. The guest's quota slot is freed, as before
-- (the quota does not count rejected magnets).
create function public.reject_job(p_job_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.print_jobs;
begin
  if p_reason is null or p_reason not in ('inappropriate', 'invalid_photo', 'print_failure') then
    raise exception 'invalid_reason' using errcode = 'P0001';
  end if;

  v_job := public.lock_job_for_operator(p_job_id);
  if v_job.status not in ('queued', 'printing', 'ready') then
    raise exception 'job_closed' using errcode = 'P0001';
  end if;

  update public.print_runs set status = 'released', finished_at = now()
  where job_id = p_job_id and status = 'sent';

  update public.print_jobs set status = 'rejected' where id = p_job_id;
  insert into public.print_job_events (job_id, event_id, from_status, to_status, reason, actor_id)
  values (p_job_id, v_job.event_id, v_job.status, 'rejected', p_reason, auth.uid());
end;
$$;

-- Admin only: undo a delivery (back to מוכן לאיסוף) or a rejection (back to בתור).
create function public.reopen_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.print_jobs;
  v_to text;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;

  v_job := public.lock_job_for_operator(p_job_id);
  v_to := case v_job.status when 'delivered' then 'ready' when 'rejected' then 'queued' end;
  if v_to is null then
    raise exception 'job_not_closed' using errcode = 'P0001';
  end if;

  update public.print_jobs set status = v_to where id = p_job_id;
  insert into public.print_job_events (job_id, event_id, from_status, to_status, actor_id)
  values (p_job_id, v_job.event_id, v_job.status, v_to, auth.uid());
end;
$$;

revoke all on function public.start_print(uuid, integer, text, text, text) from public, anon;
revoke all on function public.release_print(uuid) from public, anon;
revoke all on function public.confirm_print(uuid, boolean) from public, anon;
revoke all on function public.mark_delivered(uuid[]) from public, anon;
revoke all on function public.reject_job(uuid, text) from public, anon;
revoke all on function public.reopen_job(uuid) from public, anon;
grant execute on function public.start_print(uuid, integer, text, text, text) to authenticated;
grant execute on function public.release_print(uuid) to authenticated;
grant execute on function public.confirm_print(uuid, boolean) to authenticated;
grant execute on function public.mark_delivered(uuid[]) to authenticated;
grant execute on function public.reject_job(uuid, text) to authenticated;
grant execute on function public.reopen_job(uuid) to authenticated;

-- 6. What operators can read ---------------------------------------------------

create policy events_select_operator on public.events
  for select to authenticated
  using ((select public.is_operator()) and public.can_operate_event(id));

create policy frames_select_operator on public.frames
  for select to authenticated
  using ((select public.is_operator()) and public.operator_can_see_frame(id));

create policy print_jobs_select_operator on public.print_jobs
  for select to authenticated
  using ((select public.is_operator()) and public.can_operate_event(event_id));

create policy guest_photos_select_operator on public.guest_photos
  for select to authenticated
  using ((select public.is_operator()) and public.can_operate_event(event_id));

create policy media_select_operator on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (select public.is_operator())
    and public.operator_can_read_media(name)
  );

-- 7. The event counter counts physical magnets --------------------------------

create or replace function public.event_magnet_counts(p_event_ids uuid[])
returns table (
  event_id uuid,
  queued integer,
  printing integer,
  ready integer,
  delivered integer,
  rejected integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and not public.is_operator() then
    raise exception 'not_admin'
      using errcode = 'P0001';
  end if;

  -- Each magnet counts its printed copies (first prints and added copies;
  -- reprints replace and do not count), or 1 while it has not printed yet.
  return query
  with allowed as (
    select distinct e as id
    from unnest(p_event_ids) as e
    where public.can_operate_event(e)
  ),
  per_job as (
    select
      pj.event_id,
      pj.status,
      greatest(
        1,
        coalesce((
          select sum(r.copies)
          from public.print_runs as r
          where r.job_id = pj.id
            and r.kind = 'print'
            and r.status = 'printed'
        ), 0)
      )::integer as magnets
    from public.print_jobs as pj
    join allowed as a on a.id = pj.event_id
  )
  select
    per_job.event_id,
    coalesce(sum(magnets) filter (where status = 'queued'), 0)::integer,
    coalesce(sum(magnets) filter (where status = 'printing'), 0)::integer,
    coalesce(sum(magnets) filter (where status = 'ready'), 0)::integer,
    coalesce(sum(magnets) filter (where status = 'delivered'), 0)::integer,
    coalesce(sum(magnets) filter (where status = 'rejected'), 0)::integer
  from per_job
  group by per_job.event_id;
end;
$$;

commit;
