-- MagnetimShare row level security.
-- is_admin() and the event card view live here because policies depend on them.
-- No rows. No role changes. No changes to auth.users.

begin;

create function public.is_admin()
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
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create function public.event_is_live(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events
    where id = p_event_id
      and status = 'live'
  );
$$;

revoke all on function public.event_is_live(uuid) from public;
grant execute on function public.event_is_live(uuid) to authenticated;

-- Allowlist: the auth hook role only. No policy for anon or authenticated.
revoke all on table public.signin_allowlist from anon, authenticated;
grant select on table public.signin_allowlist to supabase_auth_admin;

create policy signin_allowlist_select_hook
  on public.signin_allowlist
  for select
  to supabase_auth_admin
  using (true);

-- Profiles: a user can read only their own row. No insert, update, or delete policy.
create policy admin_profiles_select_own
  on public.admin_profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

-- Frames: published rows are public. Admins manage every row.
create policy frames_select_published
  on public.frames
  for select
  to anon, authenticated
  using (is_published);

create policy frames_select_admin
  on public.frames
  for select
  to authenticated
  using ((select public.is_admin()));

create policy frames_insert_admin
  on public.frames
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy frames_update_admin
  on public.frames
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy frames_delete_admin
  on public.frames
  for delete
  to authenticated
  using ((select public.is_admin()));

-- Leads: anyone may submit a new lead. Only admins can read or change one.
create policy leads_insert_public
  on public.leads
  for insert
  to anon, authenticated
  with check (status = 'new');

create policy leads_select_admin
  on public.leads
  for select
  to authenticated
  using ((select public.is_admin()));

create policy leads_update_admin
  on public.leads
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Events: the base table is admin-only. A guest cannot be given a select
-- policy here, because row policies cannot hide lead_id or created_at.
create policy events_select_admin
  on public.events
  for select
  to authenticated
  using ((select public.is_admin()));

create policy events_insert_admin
  on public.events
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy events_update_admin
  on public.events
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy events_delete_admin
  on public.events
  for delete
  to authenticated
  using ((select public.is_admin()));

-- Camera card: live events, public columns only. The view owner applies the
-- filter, so a guest does not need select access to the base table.
-- Intentional: security_invoker stays false. The view exposes only live events
-- and only the eight camera columns. lead_id and created_at are excluded by design.
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
  status
from public.events
where status = 'live';

grant select on table public.event_cards to anon, authenticated;

-- Photos: a guest sees and adds only their own rows.
create policy guest_photos_select_own
  on public.guest_photos
  for select
  to authenticated
  using (guest_id = (select auth.uid()) or (select public.is_admin()));

create policy guest_photos_insert_own
  on public.guest_photos
  for insert
  to authenticated
  with check (
    guest_id = (select auth.uid())
    and (select public.event_is_live(event_id))
  );

-- Print jobs: guests add a queued job for their own photo. Admins change status and copies.
revoke update on table public.print_jobs from anon, authenticated;
grant update (status, copies) on table public.print_jobs to authenticated;

create policy print_jobs_select_own
  on public.print_jobs
  for select
  to authenticated
  using (guest_id = (select auth.uid()) or (select public.is_admin()));

create policy print_jobs_insert_own
  on public.print_jobs
  for insert
  to authenticated
  with check (
    guest_id = (select auth.uid())
    and status = 'queued'
    and (select public.event_is_live(event_id))
    and event_id = (
      select p.event_id
      from public.guest_photos as p
      where p.id = print_jobs.photo_id
        and p.guest_id = (select auth.uid())
    )
  );

create policy print_jobs_update_admin
  on public.print_jobs
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

commit;
