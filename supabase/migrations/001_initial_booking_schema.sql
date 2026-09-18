-- KISU.TATTS BOOKING SYSTEM
-- Initial database schema

create extension if not exists pgcrypto;

create type public.booking_slot_status as enum (
  'available',
  'pending',
  'booked',
  'blocked'
);

create type public.booking_request_status as enum (
  'pending',
  'confirmed',
  'rejected',
  'cancelled'
);

create table public.booking_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_slot_status not null default 'available',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_slots_valid_time check (ends_at > starts_at)
);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.booking_slots(id) on delete restrict,
  name text not null,
  contact text not null,
  idea text not null,
  budget text,
  status public.booking_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_request_name_length check (char_length(trim(name)) between 1 and 100),
  constraint booking_request_contact_length check (char_length(trim(contact)) between 1 and 200),
  constraint booking_request_idea_length check (char_length(trim(idea)) between 1 and 5000),
  constraint booking_request_budget_length check (budget is null or char_length(trim(budget)) <= 200)
);

create unique index booking_requests_one_active_per_slot
on public.booking_requests(slot_id)
where status in ('pending', 'confirmed');

create table public.booking_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.booking_requests(id) on delete cascade,
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  constraint booking_attachment_file_size check (file_size is null or file_size > 0)
);

create index booking_slots_starts_at_idx on public.booking_slots(starts_at);
create index booking_slots_status_idx on public.booking_slots(status);
create index booking_requests_slot_id_idx on public.booking_requests(slot_id);
create index booking_requests_status_idx on public.booking_requests(status);
create index booking_requests_created_at_idx on public.booking_requests(created_at desc);
create index booking_attachments_request_id_idx on public.booking_attachments(request_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger booking_slots_set_updated_at
before update on public.booking_slots
for each row execute function public.set_updated_at();

create trigger booking_requests_set_updated_at
before update on public.booking_requests
for each row execute function public.set_updated_at();

alter table public.booking_slots enable row level security;
alter table public.booking_requests enable row level security;
alter table public.booking_attachments enable row level security;

create policy "Public can view available booking slots"
on public.booking_slots
for select
to anon
using (status = 'available' and starts_at > now());

-- booking_requests and booking_attachments intentionally have no public policies.
-- Booking creation is performed server-side through the atomic RPC in migration 002.
-- Administrative policies will be added when Eva's admin authentication is configured.
