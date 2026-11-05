-- MagnetimShare allowlist and the before-user-created hook.
-- Inserts the two allowed emails only. Does not change existing users, profiles, or roles.
-- Does not promote anyone to admin.
--
-- Anonymous users are returned before the allowlist is read.
-- Email-and-password sign-ups are refused. Google is allowed only when the email is listed.
--
-- This file creates the function. Point the Auth "Before user created" hook at
-- public.hook_before_user_created after it is applied. This file does not enable that hook.

begin;

alter table public.signin_allowlist
  add constraint signin_allowlist_email_lowercase
  check (email = lower(email));

insert into public.signin_allowlist (email)
values (lower('effitag@gmail.com')), (lower('memoriashare@gmail.com'))
on conflict (email) do nothing;

create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text;
  v_email text;
begin
  if coalesce(event -> 'user' ->> 'is_anonymous', '') = 'true' then
    return event;
  end if;

  v_provider := coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', '');
  if v_provider <> 'google' then
    raise exception 'email_password_not_allowed'
      using errcode = 'P0001';
  end if;

  v_email := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
  if not exists (
    select 1
    from public.signin_allowlist
    where email = v_email
  ) then
    raise exception 'not_on_allowlist'
      using errcode = 'P0001';
  end if;

  return event;
end;
$$;

revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

commit;
