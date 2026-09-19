import { NextResponse } from 'next/server'
import { getSupabaseServerConfig } from '@/lib/supabase/config'
import {
  getTelegramWebhookSecret,
  sendBookingTelegramNotification,
} from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type PendingBookingRow = {
  id: string
  status: string
  created_at: string
}

export async function POST(request: Request) {
  const expectedSecret = getTelegramWebhookSecret()
  const suppliedSecret = request.headers.get('x-telegram-bot-api-secret-token') || ''

  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const { supabaseUrl, secretKey } = getSupabaseServerConfig()
  const params = new URLSearchParams({
    select: 'id,status,created_at',
    status: 'eq.pending',
    order: 'created_at.desc',
    limit: '1',
  })

  const bookingResponse = await fetch(
    `${supabaseUrl}/rest/v1/booking_requests?${params.toString()}`,
    {
      headers: { apikey: secretKey },
      cache: 'no-store',
    },
  )

  const raw = await bookingResponse.text()

  if (!bookingResponse.ok) {
    let detail = raw
    try {
      const parsed = JSON.parse(raw)
      detail = parsed?.message || parsed?.code || raw
    } catch {}

    return NextResponse.json({
      ok: false,
      stage: 'load-pending-booking',
      supabaseStatus: bookingResponse.status,
      error: detail,
    }, { status: 502 })
  }

  let rows: PendingBookingRow[] = []
  try {
    rows = JSON.parse(raw) as PendingBookingRow[]
  } catch {
    return NextResponse.json({
      ok: false,
      stage: 'parse-pending-booking',
      error: 'Supabase returned an unexpected response.',
    }, { status: 502 })
  }

  const booking = rows[0]
  if (!booking) {
    return NextResponse.json({
      ok: false,
      stage: 'load-pending-booking',
      error: 'No pending booking request was found.',
    }, { status: 404 })
  }

  try {
    const notification = await sendBookingTelegramNotification(booking.id)
    return NextResponse.json({
      ok: true,
      stage: 'notification-sent',
      requestId: booking.id,
      notification,
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      stage: 'send-booking-notification',
      requestId: booking.id,
      error: error instanceof Error ? error.message : 'Booking notification failed.',
    }, { status: 502 })
  }
}
