-- Guests find an event only by its link, and a frame only by its id.
--
-- Before: anyone could list every live and closed event (names, date, place)
-- from public.event_cards, and every published frame row, including the
-- design with the names, from public.frames.
-- After: guests call get_event_card(slug) and get_frame_window(id). Each
-- returns at most one row and only the columns the guest screens use.
-- Admins keep reading events and frames through their own policies.
-- No rows. No role changes.

begin;

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
  screen_path_portrait text
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
    c.screen_path_portrait
  from public.event_cards as c
  where c.slug = p_slug
  limit 1;
$$;

revoke all on function public.get_event_card(text) from public;
grant execute on function public.get_event_card(text) to anon, authenticated;

-- The view stays for get_event_card. Nobody outside reads it directly.
revoke select on table public.event_cards from anon, authenticated;

create function public.get_frame_window(p_id uuid)
returns table (
  id uuid,
  width_mm integer,
  height_mm integer,
  window_x numeric,
  window_y numeric,
  window_w numeric,
  window_h numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    f.id,
    f.width_mm,
    f.height_mm,
    f.window_x,
    f.window_y,
    f.window_w,
    f.window_h
  from public.frames as f
  where f.id = p_id
    and f.is_published is true
    and f.is_template is not true;
$$;

revoke all on function public.get_frame_window(uuid) from public;
grant execute on function public.get_frame_window(uuid) to anon, authenticated;

-- Published frames are no longer listable. Frame files stay readable by path
-- through media_select_published_frame, which does not use this policy.
drop policy frames_select_published on public.frames;

commit;
