-- Operators managed from the admin's "צוות" screen (PR D).
--
-- 1. signin_allowlist.invited_role: 'operator' for an email the admin invited
--    as a print-station operator. Existing rows stay null (admins, added by
--    hand as before). The sign-in hook is unchanged: an invited operator
--    signs in with Google like an admin.
-- 2. On an invited operator's first sign-in, a trigger on auth.users creates
--    their admin_profiles row with role 'operator'. Anonymous guests and
--    everyone else are untouched.
-- 3. Admin-only functions:
--    - list_staff(): admins and operators (signed in or still invited), with
--      the events each operator is assigned to;
--    - invite_operator(email): adds the email to the allowlist as an operator,
--      and creates the operator profile at once if the account already exists;
--    - remove_operator(email): removes the operator profile (and with it their
--      event assignments) and their allowlist row. Admins cannot be removed here.
--    Assigning an operator to an event uses event_operators directly (admin
--    RLS from 202611180001).
-- No existing row changes.

begin;

alter table public.signin_allowlist
  add column invited_role text
    constraint signin_allowlist_invited_role_check check (invited_role is null or invited_role = 'operator');

-- First sign-in of an invited operator: create their profile.
create function public.create_invited_operator_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_anonymous is true or new.email is null then
    return new;
  end if;

  insert into public.admin_profiles (id, email, role)
  select new.id, lower(new.email), 'operator'
  from public.signin_allowlist as a
  where a.email = lower(new.email)
    and a.invited_role = 'operator'
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.create_invited_operator_profile() from public, anon, authenticated;

create trigger on_auth_user_created_operator
  after insert on auth.users
  for each row execute function public.create_invited_operator_profile();

create function public.list_staff()
returns table (
  email text,
  role text,
  user_id uuid,
  signed_in boolean,
  event_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;

  return query
  with people as (
    select p.email, p.role, p.id as user_id, true as signed_in
    from public.admin_profiles as p
    where p.role in ('admin', 'operator')
    union all
    select a.email, 'operator', null::uuid, false
    from public.signin_allowlist as a
    where a.invited_role = 'operator'
      and not exists (select 1 from public.admin_profiles as p where p.email = a.email)
  )
  select
    people.email,
    people.role,
    people.user_id,
    people.signed_in,
    coalesce(
      (select array_agg(eo.event_id order by eo.added_at) from public.event_operators as eo where eo.operator_id = people.user_id),
      '{}'
    )
  from people
  order by people.role, people.email;
end;
$$;

create function public.invite_operator(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.admin_profiles where email = v_email and role = 'admin') then
    raise exception 'already_admin' using errcode = 'P0001';
  end if;

  insert into public.signin_allowlist (email, invited_role)
  values (v_email, 'operator')
  on conflict (email) do update set invited_role = 'operator';

  -- Already has an account (for example signed in before): operator now.
  select id into v_user from auth.users where lower(email) = v_email and is_anonymous is not true limit 1;
  if v_user is not null then
    insert into public.admin_profiles (id, email, role)
    values (v_user, v_email, 'operator')
    on conflict (id) do update set role = 'operator'
    where public.admin_profiles.role = 'pending';
  end if;

  return v_email;
end;
$$;

create function public.remove_operator(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(pg_catalog.btrim(coalesce(p_email, '')));
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.admin_profiles where email = v_email and role = 'admin') then
    raise exception 'already_admin' using errcode = 'P0001';
  end if;

  -- Their event assignments go with the profile (on delete cascade).
  delete from public.admin_profiles where email = v_email and role = 'operator';
  delete from public.signin_allowlist where email = v_email and invited_role = 'operator';
end;
$$;

revoke all on function public.list_staff() from public, anon;
revoke all on function public.invite_operator(text) from public, anon;
revoke all on function public.remove_operator(text) from public, anon;
grant execute on function public.list_staff() to authenticated;
grant execute on function public.invite_operator(text) to authenticated;
grant execute on function public.remove_operator(text) to authenticated;

commit;
