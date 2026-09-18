-- Booking reference uploads: private Storage bucket + atomic attachment preparation/completion.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'booking-references',
  'booking-references',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.booking_attachments
  add column if not exists uploaded_at timestamptz;

create unique index if not exists booking_attachments_storage_path_key
  on public.booking_attachments(storage_path);

create or replace function public.prepare_booking_attachments(
  p_request_id uuid,
  p_items jsonb
)
returns table (
  attachment_id uuid,
  storage_path text,
  original_filename text,
  mime_type text,
  file_size bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_existing_count integer;
  v_attachment_id uuid;
  v_storage_path text;
  v_original_filename text;
  v_mime_type text;
  v_file_size bigint;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ATTACHMENTS' using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 5 then
    raise exception 'INVALID_ATTACHMENT_COUNT' using errcode = 'P0001';
  end if;

  -- Lock the request row so concurrent preparation calls cannot exceed the 5-file limit.
  perform 1
  from public.booking_requests br
  where br.id = p_request_id
    and br.status in ('pending', 'confirmed')
  for update;

  if not found then
    raise exception 'BOOKING_REQUEST_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  select count(*)::integer
  into v_existing_count
  from public.booking_attachments ba
  where ba.request_id = p_request_id;

  if v_existing_count + jsonb_array_length(p_items) > 5 then
    raise exception 'TOO_MANY_ATTACHMENTS' using errcode = 'P0001';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_attachment_id := (v_item->>'attachment_id')::uuid;
      v_file_size := (v_item->>'file_size')::bigint;
    exception when others then
      raise exception 'INVALID_ATTACHMENT_METADATA' using errcode = 'P0001';
    end;

    v_storage_path := trim(coalesce(v_item->>'storage_path', ''));
    v_original_filename := trim(coalesce(v_item->>'original_filename', ''));
    v_mime_type := lower(trim(coalesce(v_item->>'mime_type', '')));

    if v_storage_path = ''
      or v_original_filename = ''
      or char_length(v_original_filename) > 255
      or v_file_size <= 0
      or v_file_size > 10485760
      or v_mime_type not in ('image/jpeg','image/png','image/webp','image/heic','image/heif')
      or v_storage_path not like p_request_id::text || '/' || v_attachment_id::text || '.%'
    then
      raise exception 'INVALID_ATTACHMENT_METADATA' using errcode = 'P0001';
    end if;

    insert into public.booking_attachments (
      id,
      request_id,
      storage_path,
      original_filename,
      mime_type,
      file_size
    )
    values (
      v_attachment_id,
      p_request_id,
      v_storage_path,
      v_original_filename,
      v_mime_type,
      v_file_size
    );

    attachment_id := v_attachment_id;
    storage_path := v_storage_path;
    original_filename := v_original_filename;
    mime_type := v_mime_type;
    file_size := v_file_size;
    return next;
  end loop;
end;
$$;

create or replace function public.complete_booking_attachment(
  p_request_id uuid,
  p_attachment_id uuid,
  p_storage_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'booking-references'
      and so.name = p_storage_path
  ) then
    raise exception 'FILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.booking_attachments ba
  set uploaded_at = coalesce(ba.uploaded_at, now())
  where ba.id = p_attachment_id
    and ba.request_id = p_request_id
    and ba.storage_path = p_storage_path
    and exists (
      select 1
      from public.booking_requests br
      where br.id = p_request_id
        and br.status in ('pending', 'confirmed')
    );

  if not found then
    raise exception 'ATTACHMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.discard_prepared_booking_attachments(
  p_request_id uuid,
  p_attachment_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.booking_attachments ba
  where ba.request_id = p_request_id
    and ba.id = any(p_attachment_ids)
    and ba.uploaded_at is null;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.prepare_booking_attachments(uuid, jsonb) from public;
revoke all on function public.prepare_booking_attachments(uuid, jsonb) from anon;
revoke all on function public.prepare_booking_attachments(uuid, jsonb) from authenticated;
grant execute on function public.prepare_booking_attachments(uuid, jsonb) to service_role;

revoke all on function public.complete_booking_attachment(uuid, uuid, text) from public;
revoke all on function public.complete_booking_attachment(uuid, uuid, text) from anon;
revoke all on function public.complete_booking_attachment(uuid, uuid, text) from authenticated;
grant execute on function public.complete_booking_attachment(uuid, uuid, text) to service_role;

revoke all on function public.discard_prepared_booking_attachments(uuid, uuid[]) from public;
revoke all on function public.discard_prepared_booking_attachments(uuid, uuid[]) from anon;
revoke all on function public.discard_prepared_booking_attachments(uuid, uuid[]) from authenticated;
grant execute on function public.discard_prepared_booking_attachments(uuid, uuid[]) to service_role;
