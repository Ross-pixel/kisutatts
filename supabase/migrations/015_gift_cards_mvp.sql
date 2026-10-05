create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  initial_amount_cents integer not null,
  balance_cents integer not null,
  status text not null default 'active',
  recipient_name text not null,
  from_name text,
  message text,
  buyer_contact text,
  internal_note text,
  created_by_telegram_id text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gift_cards_amount_positive check (initial_amount_cents > 0 and initial_amount_cents <= 1000000),
  constraint gift_cards_balance_valid check (balance_cents >= 0 and balance_cents <= initial_amount_cents),
  constraint gift_cards_status_valid check (status in ('active', 'redeemed', 'void')),
  constraint gift_cards_code_format check (code ~ '^KISU-[0-9A-F]{6}-[0-9A-F]{6}$'),
  constraint gift_cards_recipient_length check (char_length(trim(recipient_name)) between 1 and 100),
  constraint gift_cards_from_length check (from_name is null or char_length(trim(from_name)) <= 100),
  constraint gift_cards_message_length check (message is null or char_length(message) <= 1000),
  constraint gift_cards_buyer_contact_length check (buyer_contact is null or char_length(trim(buyer_contact)) <= 200),
  constraint gift_cards_internal_note_length check (internal_note is null or char_length(internal_note) <= 2000)
);

create table public.gift_card_transactions (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  kind text not null,
  amount_cents integer not null,
  note text,
  booking_request_id uuid references public.booking_requests(id) on delete set null,
  created_by_telegram_id text,
  created_at timestamptz not null default now(),
  constraint gift_card_transactions_kind_valid check (kind in ('issued', 'redeemed', 'adjustment', 'voided')),
  constraint gift_card_transactions_amount_valid check (
    (kind = 'issued' and amount_cents > 0)
    or (kind = 'redeemed' and amount_cents < 0)
    or (kind = 'adjustment' and amount_cents <> 0)
    or (kind = 'voided' and amount_cents = 0)
  ),
  constraint gift_card_transactions_note_length check (note is null or char_length(note) <= 2000)
);

alter table public.booking_requests
  add column gift_card_id uuid references public.gift_cards(id) on delete set null;

create index gift_cards_status_idx on public.gift_cards(status);
create index gift_cards_created_at_idx on public.gift_cards(created_at desc);
create index gift_card_transactions_card_idx on public.gift_card_transactions(gift_card_id, created_at desc);
create index booking_requests_gift_card_idx on public.booking_requests(gift_card_id) where gift_card_id is not null;

create trigger gift_cards_set_updated_at
before update on public.gift_cards
for each row execute function public.set_updated_at();

alter table public.gift_cards enable row level security;
alter table public.gift_card_transactions enable row level security;

revoke all on table public.gift_cards from public, anon, authenticated;
revoke all on table public.gift_card_transactions from public, anon, authenticated;
grant select on table public.gift_cards to service_role;
grant select on table public.gift_card_transactions to service_role;

create or replace function public.create_gift_card(
  p_amount_cents integer,
  p_recipient_name text,
  p_from_name text default null,
  p_message text default null,
  p_buyer_contact text default null,
  p_internal_note text default null,
  p_created_by_telegram_id text default null
)
returns table(id uuid, code text, public_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_code text;
  v_public_token text;
  v_attempt integer := 0;
begin
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 1000000 then
    raise exception 'GIFT_CARD_INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  if nullif(trim(coalesce(p_recipient_name, '')), '') is null then
    raise exception 'GIFT_CARD_RECIPIENT_REQUIRED' using errcode = 'P0001';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := 'KISU-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)) || '-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 7, 6));
    exit when not exists (select 1 from public.gift_cards g where g.code = v_code);
    if v_attempt >= 10 then
      raise exception 'GIFT_CARD_CODE_GENERATION_FAILED' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.gift_cards (
    code,
    initial_amount_cents,
    balance_cents,
    recipient_name,
    from_name,
    message,
    buyer_contact,
    internal_note,
    created_by_telegram_id
  ) values (
    v_code,
    p_amount_cents,
    p_amount_cents,
    trim(p_recipient_name),
    nullif(trim(coalesce(p_from_name, '')), ''),
    nullif(trim(coalesce(p_message, '')), ''),
    nullif(trim(coalesce(p_buyer_contact, '')), ''),
    nullif(trim(coalesce(p_internal_note, '')), ''),
    nullif(trim(coalesce(p_created_by_telegram_id, '')), '')
  )
  returning gift_cards.id, gift_cards.public_token into v_id, v_public_token;

  insert into public.gift_card_transactions (
    gift_card_id,
    kind,
    amount_cents,
    note,
    created_by_telegram_id
  ) values (
    v_id,
    'issued',
    p_amount_cents,
    'Gift card issued',
    nullif(trim(coalesce(p_created_by_telegram_id, '')), '')
  );

  return query select v_id, v_code, v_public_token;
end;
$$;

create or replace function public.redeem_gift_card(
  p_gift_card_id uuid,
  p_amount_cents integer,
  p_note text default null,
  p_booking_request_id uuid default null,
  p_created_by_telegram_id text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_status text;
  v_new_balance integer;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'GIFT_CARD_INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  select balance_cents, status
  into v_balance, v_status
  from public.gift_cards
  where id = p_gift_card_id
  for update;

  if not found then
    raise exception 'GIFT_CARD_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_status <> 'active' then
    raise exception 'GIFT_CARD_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if p_amount_cents > v_balance then
    raise exception 'GIFT_CARD_INSUFFICIENT_BALANCE' using errcode = 'P0001';
  end if;

  v_new_balance := v_balance - p_amount_cents;

  update public.gift_cards
  set balance_cents = v_new_balance,
      status = case when v_new_balance = 0 then 'redeemed' else 'active' end,
      updated_at = now()
  where id = p_gift_card_id;

  insert into public.gift_card_transactions (
    gift_card_id,
    kind,
    amount_cents,
    note,
    booking_request_id,
    created_by_telegram_id
  ) values (
    p_gift_card_id,
    'redeemed',
    -p_amount_cents,
    nullif(trim(coalesce(p_note, '')), ''),
    p_booking_request_id,
    nullif(trim(coalesce(p_created_by_telegram_id, '')), '')
  );

  return v_new_balance;
end;
$$;

create or replace function public.void_gift_card(
  p_gift_card_id uuid,
  p_note text default null,
  p_created_by_telegram_id text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.gift_cards
  where id = p_gift_card_id
  for update;

  if not found then
    raise exception 'GIFT_CARD_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_status = 'void' then
    return 'void';
  end if;

  if v_status <> 'active' then
    raise exception 'GIFT_CARD_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  update public.gift_cards
  set status = 'void', voided_at = now(), updated_at = now()
  where id = p_gift_card_id;

  insert into public.gift_card_transactions (
    gift_card_id,
    kind,
    amount_cents,
    note,
    created_by_telegram_id
  ) values (
    p_gift_card_id,
    'voided',
    0,
    nullif(trim(coalesce(p_note, '')), ''),
    nullif(trim(coalesce(p_created_by_telegram_id, '')), '')
  );

  return 'void';
end;
$$;

create or replace function public.create_booking_request(
  p_slot_id uuid,
  p_name text,
  p_contact text,
  p_idea text,
  p_budget text,
  p_gift_card_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_gift_card_id uuid;
  v_gift_code text := upper(trim(coalesce(p_gift_card_code, '')));
begin
  if v_gift_code <> '' then
    select id into v_gift_card_id
    from public.gift_cards
    where code = v_gift_code
      and status = 'active'
      and balance_cents > 0;

    if not found then
      raise exception 'GIFT_CARD_INVALID' using errcode = 'P0001';
    end if;
  end if;

  update public.booking_slots
  set status = 'pending', updated_at = now()
  where id = p_slot_id
    and status = 'available'
    and starts_at > now()
  returning starts_at, ends_at into v_starts_at, v_ends_at;

  if not found then
    raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.booking_requests (
    slot_id,
    name,
    contact,
    idea,
    budget,
    gift_card_id,
    status,
    requested_starts_at,
    requested_ends_at,
    scheduled_starts_at,
    scheduled_ends_at,
    privacy_accepted_at,
    privacy_notice_version
  ) values (
    p_slot_id,
    trim(p_name),
    trim(p_contact),
    trim(p_idea),
    nullif(trim(p_budget), ''),
    v_gift_card_id,
    'pending',
    v_starts_at,
    v_ends_at,
    v_starts_at,
    v_ends_at,
    now(),
    '2026-10-05'
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.create_gift_card(integer, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.redeem_gift_card(uuid, integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.void_gift_card(uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_booking_request(uuid, text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.create_gift_card(integer, text, text, text, text, text, text) to service_role;
grant execute on function public.redeem_gift_card(uuid, integer, text, uuid, text) to service_role;
grant execute on function public.void_gift_card(uuid, text, text) to service_role;
grant execute on function public.create_booking_request(uuid, text, text, text, text, text) to service_role;
