-- Guests write photos and magnets only through create_guest_print.
--
-- Before: a signed-in guest could also insert rows into guest_photos and
-- print_jobs directly through the database API (policies
-- guest_photos_insert_own and print_jobs_insert_own). That path skipped the
-- send function's checks: the frame must belong to the event, the photo file
-- must be uploaded, and copies are always 1 (202611170001).
-- After: both insert policies are gone and anon and authenticated lose the
-- INSERT grant on both tables, so the only way a guest creates a photo row or
-- a magnet is create_guest_print, which runs as the table owner (security
-- definer) and is not affected.
--
-- The app never inserts into these tables directly; every send already goes
-- through create_guest_print. Reading stays as it is (guest_photos_select_own,
-- print_jobs_select_own), and admins keep updating print_jobs
-- (print_jobs_update_admin). No rows changed.

begin;

drop policy guest_photos_insert_own on public.guest_photos;
drop policy print_jobs_insert_own on public.print_jobs;

revoke insert on table public.guest_photos from anon, authenticated;
revoke insert on table public.print_jobs from anon, authenticated;

commit;
