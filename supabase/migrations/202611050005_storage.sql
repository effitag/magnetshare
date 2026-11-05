-- MagnetimShare private media bucket.
-- Object path: {event_id}/{guest_id}/{timestamp}_{filename}
-- guest_id is auth.uid() and stays the second folder. No public read.

begin;

insert into storage.buckets (id, name, public)
values ('media', 'media', false);

create policy media_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy media_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'media'
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );

commit;
