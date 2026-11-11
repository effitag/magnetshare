-- Part 1: the event's magnet counter and the thank-you screen after closing.
--
-- 1. events.magnet_target: an optional target in physical magnets, typed by
--    the admin. Only for the counter and its alerts; nothing reads it to
--    block a send.
-- 2. event_magnet_counts(ids): admin only. Physical magnets (copies included)
--    per event and status, for the event page and the events list. Read only.
-- 3. print_jobs_event_status_idx: the counter reads one event's jobs by
--    status, including rejected ones, which the guest quota index leaves out.
-- 4. event_cards: a closed event still returns its frames' screen images, so
--    the guest's thank-you screen shows the event's design. The cover photo
--    stays live only, as before.
--
-- Closing is unchanged: the admin sets events.status = 'closed'. A send that
-- is already inside create_guest_print at that moment still completes; one
-- that starts after it is refused with event_not_live, as today.
-- No change to create_guest_print, the quota trigger, any lock or any RLS
-- policy. No new table. No rows changed.

begin;

alter table public.events
  add column magnet_target integer
    constraint events_magnet_target_positive check (magnet_target is null or magnet_target > 0);

comment on column public.events.magnet_target is
  'Optional target in physical magnets for the admin counter. Never enforced.';

create index print_jobs_event_status_idx
  on public.print_jobs (event_id, status);

create function public.event_magnet_counts(p_event_ids uuid[])
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
  if not public.is_admin() then
    raise exception 'not_admin'
      using errcode = 'P0001';
  end if;

  return query
  select
    pj.event_id,
    coalesce(sum(pj.copies) filter (where pj.status = 'queued'), 0)::integer,
    coalesce(sum(pj.copies) filter (where pj.status = 'printing'), 0)::integer,
    coalesce(sum(pj.copies) filter (where pj.status = 'ready'), 0)::integer,
    coalesce(sum(pj.copies) filter (where pj.status = 'delivered'), 0)::integer,
    coalesce(sum(pj.copies) filter (where pj.status = 'rejected'), 0)::integer
  from public.print_jobs as pj
  where pj.event_id = any (p_event_ids)
  group by pj.event_id;
end;
$$;

revoke all on function public.event_magnet_counts(uuid[]) from public;
-- Supabase's default privileges grant new functions to anon too; guests never need this one.
revoke all on function public.event_magnet_counts(uuid[]) from anon;
grant execute on function public.event_magnet_counts(uuid[]) to authenticated;

-- Same columns, options and grants as before; only the two screen paths change.
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
    end as screen_path_portrait
  from public.events
  where events.status in ('live', 'closed');

commit;
