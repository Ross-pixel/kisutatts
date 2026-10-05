import { NextResponse } from 'next/server'
import { getTelegramAdminFromRequest } from '@/lib/telegram-admin'
import { getSupabaseServerConfig } from '@/lib/supabase/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

async function supabaseJson(url: string, secretKey: string) {
  const response = await fetch(url, {
    headers: { apikey: secretKey },
    cache: 'no-store',
  })
  const raw = await response.text()
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${raw}`)
  return raw ? JSON.parse(raw) : null
}

async function rpc(
  supabaseUrl: string,
  secretKey: string,
  name: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: secretKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const raw = await response.text()
  if (!response.ok) {
    let message = raw
    try {
      const parsed = JSON.parse(raw)
      message = parsed?.message || raw
    } catch {}
    throw new Error(message)
  }
  return raw ? JSON.parse(raw) : null
}

export async function GET(request: Request) {
  const identity = getTelegramAdminFromRequest(request)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { supabaseUrl, secretKey } = getSupabaseServerConfig()
    const [cards, transactions] = await Promise.all([
      supabaseJson(
        `${supabaseUrl}/rest/v1/gift_cards?select=id,code,public_token,initial_amount_cents,balance_cents,status,recipient_name,from_name,message,buyer_contact,internal_note,created_at,updated_at,voided_at&order=created_at.desc`,
        secretKey,
      ),
      supabaseJson(
        `${supabaseUrl}/rest/v1/gift_card_transactions?select=id,gift_card_id,kind,amount_cents,note,booking_request_id,created_by_telegram_id,created_at&order=created_at.desc&limit=500`,
        secretKey,
      ),
    ])

    return NextResponse.json({
      admin: {
        id: identity.user.id,
        firstName: identity.user.first_name || '',
        username: identity.user.username || '',
      },
      cards,
      transactions,
    })
  } catch (error) {
    console.error('Gift card admin load error:', error)
    return NextResponse.json({ error: 'Unable to load gift cards.' }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const identity = getTelegramAdminFromRequest(request)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const action = clean(body?.action)
  const { supabaseUrl, secretKey } = getSupabaseServerConfig()
  const actor = String(identity.user.id)

  try {
    if (action === 'create') {
      const amountCents = Number(body?.amountCents)
      const recipientName = clean(body?.recipientName)
      const fromName = clean(body?.fromName)
      const message = clean(body?.message)
      const buyerContact = clean(body?.buyerContact)
      const internalNote = clean(body?.internalNote)

      if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 1_000_000) {
        return NextResponse.json({ error: 'Enter a valid gift card value.' }, { status: 400 })
      }
      if (!recipientName || recipientName.length > 100) {
        return NextResponse.json({ error: 'Recipient name is required.' }, { status: 400 })
      }
      if (fromName.length > 100 || message.length > 1000 || buyerContact.length > 200 || internalNote.length > 2000) {
        return NextResponse.json({ error: 'One of the fields is too long.' }, { status: 400 })
      }

      const created = await rpc(supabaseUrl, secretKey, 'create_gift_card', {
        p_amount_cents: amountCents,
        p_recipient_name: recipientName,
        p_from_name: fromName || null,
        p_message: message || null,
        p_buyer_contact: buyerContact || null,
        p_internal_note: internalNote || null,
        p_created_by_telegram_id: actor,
      }) as Array<{ id: string; code: string; public_token: string }>

      const item = created?.[0]
      if (!item) throw new Error('Gift card was created without a result.')

      return NextResponse.json({ ok: true, card: item }, { status: 201 })
    }

    if (action === 'redeem') {
      const giftCardId = clean(body?.giftCardId)
      const amountCents = Number(body?.amountCents)
      const note = clean(body?.note)
      const bookingRequestId = clean(body?.bookingRequestId)

      if (!UUID_RE.test(giftCardId)) {
        return NextResponse.json({ error: 'Invalid gift card.' }, { status: 400 })
      }
      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return NextResponse.json({ error: 'Enter a valid amount to redeem.' }, { status: 400 })
      }
      if (note.length > 2000) {
        return NextResponse.json({ error: 'Note is too long.' }, { status: 400 })
      }
      if (bookingRequestId && !UUID_RE.test(bookingRequestId)) {
        return NextResponse.json({ error: 'Invalid booking request.' }, { status: 400 })
      }

      const balanceCents = await rpc(supabaseUrl, secretKey, 'redeem_gift_card', {
        p_gift_card_id: giftCardId,
        p_amount_cents: amountCents,
        p_note: note || null,
        p_booking_request_id: bookingRequestId || null,
        p_created_by_telegram_id: actor,
      })

      return NextResponse.json({ ok: true, balanceCents })
    }

    if (action === 'void') {
      const giftCardId = clean(body?.giftCardId)
      const note = clean(body?.note)
      if (!UUID_RE.test(giftCardId)) {
        return NextResponse.json({ error: 'Invalid gift card.' }, { status: 400 })
      }
      if (note.length > 2000) {
        return NextResponse.json({ error: 'Note is too long.' }, { status: 400 })
      }

      await rpc(supabaseUrl, secretKey, 'void_gift_card', {
        p_gift_card_id: giftCardId,
        p_note: note || null,
        p_created_by_telegram_id: actor,
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    console.error('Gift card admin action error:', error)

    if (message.includes('GIFT_CARD_INSUFFICIENT_BALANCE')) {
      return NextResponse.json({ error: 'The amount is higher than the remaining balance.' }, { status: 409 })
    }
    if (message.includes('GIFT_CARD_NOT_ACTIVE')) {
      return NextResponse.json({ error: 'This gift card is no longer active.' }, { status: 409 })
    }
    if (message.includes('GIFT_CARD_NOT_FOUND')) {
      return NextResponse.json({ error: 'Gift card not found.' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Unable to update gift card.' }, { status: 502 })
  }
}
