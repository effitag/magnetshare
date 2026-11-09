-- Sign-in allowlist: add magnetimshare@gmail.com, remove memoriashare@gmail.com.
--
-- magnetimshare@gmail.com is a test user on the Google OAuth consent screen and
-- will be the second admin. memoriashare@gmail.com is not a Google test user and
-- cannot sign in, so it leaves the list.
-- Does not create users or admin profiles, and does not change any role.
-- The admin_profiles row is added separately after the first sign-in.

begin;

insert into public.signin_allowlist (email)
values (lower('magnetimshare@gmail.com'))
on conflict (email) do nothing;

delete from public.signin_allowlist
where email = lower('memoriashare@gmail.com');

commit;
