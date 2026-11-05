-- Short events: a frame is optional until the event goes live.
-- Cover files live at events/{event_id}/cover.*.
-- Does not insert rows, and does not change any role.

begin;

alter table public.events
  alter column frame_id drop not null;

alter table public.events
  add column cover_path text;

alter table public.events
  add constraint events_cover_prefix check (
    cover_path is null
    or cover_path like 'events/' || id::text || '/cover.%'
  );

-- A live event must point at a published frame that is not a template.
create function public.events_require_published_frame()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'live' and not exists (
    select 1
    from public.frames
    where id = new.frame_id
      and is_published is true
      and is_template is not true
  ) then
    raise exception 'event_frame_not_published';
  end if;
  return new;
end;
$$;

revoke all on function public.events_require_published_frame() from public, anon, authenticated;

create trigger events_require_published_frame
before insert or update on public.events
for each row execute function public.events_require_published_frame();

-- Unpublishing or deleting a frame must not leave a live event behind.
create function public.frames_reject_unpublish_while_live()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.events
      where frame_id = old.id and status = 'live'
    ) then
      raise exception 'event_frame_not_published';
    end if;
    return old;
  end if;
  if old.is_published is true and new.is_published is not true and exists (
    select 1 from public.events
    where frame_id = old.id and status = 'live'
  ) then
    raise exception 'event_frame_not_published';
  end if;
  return new;
end;
$$;

revoke all on function public.frames_reject_unpublish_while_live() from public, anon, authenticated;

create trigger frames_reject_unpublish_while_live
before update or delete on public.frames
for each row execute function public.frames_reject_unpublish_while_live();

-- Closed events stay so a guest can be told the event ended.
-- Drafts stay out, so a missing link and a draft look the same.
-- cover_path and screen_path are filled only while the event is live.
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
  print_quota,
  status,
  case when status = 'live' then cover_path else null end as cover_path,
  case
    when status = 'live' and frame_id is not null
      then 'frames/' || frame_id::text || '/screen.webp'
    else null
  end as screen_path
from public.events
where status in ('live', 'closed');

grant select on table public.event_cards to anon, authenticated;

-- Guests may read a cover only while its event is live.
create function public.event_cover_is_public(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events as e
    where e.status = 'live'
      and e.cover_path = p_name
      and (storage.foldername(p_name))[1] = 'events'
      and (storage.foldername(p_name))[2] = e.id::text
      and lower(storage.filename(p_name)) like 'cover.%'
  );
$$;

revoke all on function public.event_cover_is_public(text) from public;
grant execute on function public.event_cover_is_public(text) to anon, authenticated;

drop policy if exists media_insert_own on storage.objects;

create policy media_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] is distinct from 'frames'
    and (storage.foldername(name))[1] is distinct from 'events'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy media_insert_events_admin
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'events'
    and (select public.is_admin())
  );

create policy media_update_events_admin
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'events'
    and (select public.is_admin())
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'events'
    and (select public.is_admin())
  );

create policy media_delete_events_admin
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'events'
    and (select public.is_admin())
  );

create policy media_select_live_cover
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'media'
    and (select public.event_cover_is_public(name))
  );

commit;
