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
  v_hex text;
begin
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 1000000 then
    raise exception 'GIFT_CARD_INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  if nullif(trim(coalesce(p_recipient_name, '')), '') is null then
    raise exception 'GIFT_CARD_RECIPIENT_REQUIRED' using errcode = 'P0001';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_hex := upper(encode(extensions.gen_random_bytes(6), 'hex'));
    v_code := 'KISU-' || substr(v_hex, 1, 6) || '-' || substr(v_hex, 7, 6);
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

revoke all on function public.create_gift_card(integer, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_gift_card(integer, text, text, text, text, text, text) to service_role;
