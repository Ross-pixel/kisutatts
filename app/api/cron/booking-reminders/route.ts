import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSupabaseServerConfig } from '@/lib/supabase/config'
import { getTelegramReminderChatId } from '@/lib/telegram-access'
import { telegramApi } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HELSINKI = 'Europe/Helsinki'
const BOOKING_ADMIN_URL = 'https://kisutatts.vercel.app/admin/booking'

type ReminderKind = 'tomorrow' | 'two_hours'

type BookingReminderRow = {
  id: string
  gift_card_id: string | null
  name: string
  contact: string
  idea: string
  budget: string | null
  admin_note: string | null
  scheduled_starts_at: string
  scheduled_ends_at: string
}

type GiftCardRow = {
  id: string
  code: string
  balance_cents: number
  status: string
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || ''
  if (!secret) return false

  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(request.headers.get('authorization') || '')

  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

async function loadJson<T>(url: string, secretKey: string): Promise<T> {
  const response = await fetch(url, {
    headers: { apikey: secretKey },
    cache: 'no-store',
  })
  const raw = await response.text()
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${raw}`)
  return JSON.parse(raw) as T
}

async function callReminderRpc<T>(
  supabaseUrl: string,
  secretKey: string,
  rpc: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
    method: 'POST',
    headers: {
      apikey: secretKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const raw = await response.text()
  if (!response.ok) throw new Error(`${rpc} failed: ${response.status} ${raw}`)
  return (raw ? JSON.parse(raw) : null) as T
}

function helsinkiParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HELSINKI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  }
}

function addDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12))
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function helsinkiOffsetMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HELSINKI,
    timeZoneName: 'longOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const zone = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT+00:00'
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(zone)
  if (!match) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return match[1] === '-' ? -minutes : minutes
}

function helsinkiLocalToUtc(dateKey: string, time: string) {
  const naive = new Date(`${dateKey}T${time}:00.000Z`)
  let offset = helsinkiOffsetMinutes(naive)
  let utc = new Date(naive.getTime() - offset * 60_000)
  const correctedOffset = helsinkiOffsetMinutes(utc)
  if (correctedOffset !== offset) {
    offset = correctedOffset
    utc = new Date(naive.getTime() - offset * 60_000)
  }
  return utc
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-FI', {
    timeZone: HELSINKI,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-FI', {
    timeZone: HELSINKI,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso))
}

function formatEuro(cents: number) {
  return new Intl.NumberFormat('en-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function compact(value: string | null | undefined, max = 120) {
  const text = value?.trim().replace(/\s+/g, ' ') || ''
  if (!text) return ''
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

async function loadBookingsBetween(
  supabaseUrl: string,
  secretKey: string,
  startsAt: Date,
  endsAt: Date,
) {
  const params = new URLSearchParams()
  params.set('select', 'id,gift_card_id,name,contact,idea,budget,admin_note,scheduled_starts_at,scheduled_ends_at')
  params.set('status', 'eq.confirmed')
  params.append('scheduled_starts_at', `gte.${startsAt.toISOString()}`)
  params.append('scheduled_starts_at', `lt.${endsAt.toISOString()}`)
  params.set('order', 'scheduled_starts_at.asc')

  return await loadJson<BookingReminderRow[]>(
    `${supabaseUrl}/rest/v1/booking_requests?${params.toString()}`,
    secretKey,
  )
}

async function loadGiftCards(
  supabaseUrl: string,
  secretKey: string,
  bookings: BookingReminderRow[],
) {
  const ids = Array.from(new Set(
    bookings.map((booking) => booking.gift_card_id).filter((id): id is string => Boolean(id)),
  ))
  if (ids.length === 0) return new Map<string, GiftCardRow>()

  const params = new URLSearchParams({
    select: 'id,code,balance_cents,status',
    id: `in.(${ids.join(',')})`,
  })
  const rows = await loadJson<GiftCardRow[]>(
    `${supabaseUrl}/rest/v1/gift_cards?${params.toString()}`,
    secretKey,
  )
  return new Map(rows.map((row) => [row.id, row]))
}

async function claim(
  supabaseUrl: string,
  secretKey: string,
  bookingId: string,
  kind: ReminderKind,
  key: string,
) {
  return await callReminderRpc<boolean>(
    supabaseUrl,
    secretKey,
    'claim_booking_reminder',
    { p_request_id: bookingId, p_kind: kind, p_key: key },
  )
}

async function markSent(
  supabaseUrl: string,
  secretKey: string,
  bookingId: string,
  kind: ReminderKind,
  key: string,
) {
  await callReminderRpc<null>(
    supabaseUrl,
    secretKey,
    'mark_booking_reminder_sent',
    { p_request_id: bookingId, p_kind: kind, p_key: key },
  )
}

async function release(
  supabaseUrl: string,
  secretKey: string,
  bookingId: string,
  kind: ReminderKind,
  key: string,
  error: unknown,
) {
  try {
    await callReminderRpc<null>(
      supabaseUrl,
      secretKey,
      'release_booking_reminder',
      {
        p_request_id: bookingId,
        p_kind: kind,
        p_key: key,
        p_error: error instanceof Error ? error.message.slice(0, 1000) : 'Telegram send failed',
      },
    )
  } catch (releaseError) {
    console.error('Unable to release booking reminder claim:', releaseError)
  }
}

function reminderButton() {
  return {
    inline_keyboard: [[
      {
        text: '♡ Open booking admin',
        web_app: { url: BOOKING_ADMIN_URL },
      },
    ]],
  }
}

async function sendTomorrowSummary(
  supabaseUrl: string,
  secretKey: string,
  chatId: string,
  now: Date,
) {
  const local = helsinkiParts(now)
  // 19:00 is the normal delivery time. The extra hours are retry/fallback
  // windows, and idempotent claims prevent duplicate reminders.
  if (local.hour < 19 || local.hour > 22) return { scanned: 0, sent: 0 }

  const tomorrowKey = addDays(local.dateKey, 1)
  const start = helsinkiLocalToUtc(tomorrowKey, '00:00')
  const end = helsinkiLocalToUtc(addDays(tomorrowKey, 1), '00:00')
  const bookings = await loadBookingsBetween(supabaseUrl, secretKey, start, end)
  const claimed: BookingReminderRow[] = []

  for (const booking of bookings) {
    if (await claim(supabaseUrl, secretKey, booking.id, 'tomorrow', tomorrowKey)) {
      claimed.push(booking)
    }
  }

  if (claimed.length === 0) return { scanned: bookings.length, sent: 0 }

  const giftCards = await loadGiftCards(supabaseUrl, secretKey, claimed)
  const lines = [
    `♡ Tomorrow · ${formatDate(claimed[0].scheduled_starts_at)}`,
    '',
    `${claimed.length} confirmed appointment${claimed.length === 1 ? '' : 's'}:`,
    '',
  ]

  for (const booking of claimed) {
    const giftCard = booking.gift_card_id ? giftCards.get(booking.gift_card_id) : undefined
    lines.push(
      `${formatTime(booking.scheduled_starts_at)}–${formatTime(booking.scheduled_ends_at)} · ${booking.name}`,
      booking.contact,
    )
    const idea = compact(booking.idea)
    if (idea) lines.push(`Idea: ${idea}`)
    if (booking.admin_note?.trim()) lines.push(`Note: ${compact(booking.admin_note)}`)
    if (giftCard) lines.push(`Gift card: ${giftCard.code} · ${formatEuro(giftCard.balance_cents)} remaining`)
    lines.push('')
  }

  try {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: lines.join('\n').slice(0, 4000),
      reply_markup: reminderButton(),
    })
    for (const booking of claimed) {
      await markSent(supabaseUrl, secretKey, booking.id, 'tomorrow', tomorrowKey)
    }
    return { scanned: bookings.length, sent: claimed.length }
  } catch (error) {
    for (const booking of claimed) {
      await release(supabaseUrl, secretKey, booking.id, 'tomorrow', tomorrowKey, error)
    }
    throw error
  }
}

async function sendTwoHourReminders(
  supabaseUrl: string,
  secretKey: string,
  chatId: string,
  now: Date,
) {
  const start = new Date(now.getTime() + 90 * 60_000)
  const end = new Date(now.getTime() + 150 * 60_000)
  const bookings = await loadBookingsBetween(supabaseUrl, secretKey, start, end)
  const giftCards = await loadGiftCards(supabaseUrl, secretKey, bookings)
  let sent = 0
  const errors: string[] = []

  for (const booking of bookings) {
    const key = booking.scheduled_starts_at
    if (!await claim(supabaseUrl, secretKey, booking.id, 'two_hours', key)) continue

    const giftCard = booking.gift_card_id ? giftCards.get(booking.gift_card_id) : undefined
    const lines = [
      '♡ Appointment in about 2 hours',
      '',
      `${booking.name} · ${booking.contact}`,
      `${formatDate(booking.scheduled_starts_at)} · ${formatTime(booking.scheduled_starts_at)}–${formatTime(booking.scheduled_ends_at)}`,
    ]
    const idea = compact(booking.idea, 180)
    if (idea) lines.push('', `Idea: ${idea}`)
    if (booking.budget?.trim()) lines.push(`Budget: ${compact(booking.budget, 80)}`)
    if (booking.admin_note?.trim()) lines.push(`Private note: ${compact(booking.admin_note, 180)}`)
    if (giftCard) lines.push(`Gift card: ${giftCard.code} · ${formatEuro(giftCard.balance_cents)} remaining`)

    try {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: lines.join('\n'),
        reply_markup: reminderButton(),
      })
      await markSent(supabaseUrl, secretKey, booking.id, 'two_hours', key)
      sent += 1
    } catch (error) {
      errors.push(`${booking.id}: ${error instanceof Error ? error.message : 'unknown error'}`)
      await release(supabaseUrl, secretKey, booking.id, 'two_hours', key, error)
    }
  }

  if (errors.length > 0) console.error('Booking two-hour reminder errors:', errors)
  return { scanned: bookings.length, sent, failed: errors.length }
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: 'Booking reminders are not configured.' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const chatId = getTelegramReminderChatId()
  if (!chatId) {
    return NextResponse.json({ error: 'Telegram reminder chat is not configured.' }, { status: 503 })
  }

  try {
    const { supabaseUrl, secretKey } = getSupabaseServerConfig()
    const now = new Date()

    const [tomorrow, twoHours] = await Promise.all([
      sendTomorrowSummary(supabaseUrl, secretKey, chatId, now),
      sendTwoHourReminders(supabaseUrl, secretKey, chatId, now),
    ])

    return NextResponse.json({
      ok: twoHours.failed === 0,
      localTime: helsinkiParts(now),
      tomorrow,
      twoHours,
    }, { status: twoHours.failed === 0 ? 200 : 207 })
  } catch (error) {
    console.error('Booking reminders cron error:', error)
    return NextResponse.json({ error: 'Booking reminders failed.' }, { status: 500 })
  }
}
