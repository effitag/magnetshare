-- Frame studio columns and media policies for published frame files.
-- Does not copy studio_templates. Does not add rows. Does not change roles.
-- Object path for a frame file: frames/{frame_id}/{filename}

begin;

alter table public.frames
  add column design jsonb,
  add column bleed_mm integer not null default 0,
  add column safe_mm integer not null default 0,
  add column preview_path text,
  add column revision integer not null default 1,
  add column updated_at timestamptz not null default now();

alter table public.frames
  add constraint frames_bleed_mm_nonnegative check (bleed_mm >= 0),
  add constraint frames_safe_mm_nonnegative check (safe_mm >= 0),
  add constraint frames_design_size check (
    design is null or octet_length(design::text) <= 512000
  ),
  add constraint frames_overlay_prefix check (
    overlay_path is null or overlay_path like 'frames/' || id::text || '/%'
  ),
  add constraint frames_preview_prefix check (
    preview_path is null or preview_path like 'frames/' || id::text || '/%'
  );

create function public.frames_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.frames_before_update() from public, anon, authenticated;

create trigger frames_before_update
before update on public.frames
for each row execute function public.frames_before_update();

create function public.frame_asset_is_published(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.frames as f
    where f.is_published
      and (storage.foldername(p_name))[1] = 'frames'
      and (storage.foldername(p_name))[2] = f.id::text
  );
$$;

revoke all on function public.frame_asset_is_published(text) from public;
grant execute on function public.frame_asset_is_published(text) to anon, authenticated;

create policy media_insert_frames_admin
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'frames'
    and (select public.is_admin())
  );

create policy media_update_frames_admin
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'frames'
    and (select public.is_admin())
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'frames'
    and (select public.is_admin())
  );

create policy media_delete_frames_admin
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'frames'
    and (select public.is_admin())
  );

create policy media_select_published_frame
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'media'
    and (select public.frame_asset_is_published(name))
  );

commit;
