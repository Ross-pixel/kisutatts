import { NextResponse } from 'next/server'
import { getTelegramAdminFromRequest } from '@/lib/telegram-admin'
import { getSupabaseServerConfig } from '@/lib/supabase/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function helsinkiOffsetMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Helsinki',
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

function helsinkiLocalToUtc(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const naive = new Date(`${date}T${time}:00.000Z`)
  if (Number.isNaN(naive.getTime())) return null

  let offset = helsinkiOffsetMinutes(naive)
  let utc = new Date(naive.getTime() - offset * 60_000)
  const correctedOffset = helsinkiOffsetMinutes(utc)
  if (correctedOffset !== offset) {
    offset = correctedOffset
    utc = new Date(naive.getTime() - offset * 60_000)
  }
  return utc
}

export async function POST(request: Request) {
  if (!getTelegramAdminFromRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const requestId = clean(body?.requestId)
    const action = clean(body?.action)

    if (!UUID_RE.test(requestId) || !['confirm', 'reject', 'cancel', 'adjust'].includes(action)) {
      return NextResponse.json({ error: 'Invalid booking action.' }, { status: 400 })
    }

    const { supabaseUrl, secretKey } = getSupabaseServerConfig()

    if (action === 'adjust') {
      const date = clean(body?.date)
      const startTime = clean(body?.startTime)
      const endTime = clean(body?.endTime)
      const startsAt = helsinkiLocalToUtc(date, startTime)
      const endsAt = helsinkiLocalToUtc(date, endTime)

      if (!startsAt || !endsAt || endsAt <= startsAt) {
        return NextResponse.json({ error: 'Check the date and time range.' }, { status: 400 })
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/adjust_booking_request_schedule`, {
        method: 'POST',
        headers: {
          apikey: secretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_request_id: requestId,
          p_starts_at: startsAt.toISOString(),
          p_ends_at: endsAt.toISOString(),
        }),
        cache: 'no-store',
      })

      const raw = await response.text()
      if (!response.ok) {
        let message = raw
        try {
          const parsed = JSON.parse(raw)
          message = parsed?.message ?? raw
        } catch {}

        if (message.includes('SCHEDULE_CONFLICT')) {
          return NextResponse.json({ error: 'That time overlaps a booked, pending or blocked slot.' }, { status: 409 })
        }
        if (message.includes('REQUEST_NOT_ACTIVE')) {
          return NextResponse.json({ error: 'Only pending or confirmed bookings can be rescheduled.' }, { status: 409 })
        }
        if (message.includes('REQUEST_NOT_FOUND')) {
          return NextResponse.json({ error: 'Booking request not found.' }, { status: 404 })
        }
        if (message.includes('REQUEST_SLOT_MISMATCH')) {
          return NextResponse.json({ error: 'This booking and its calendar slot are out of sync. Refresh and try again.' }, { status: 409 })
        }

        console.error('Booking admin schedule adjustment error:', response.status, raw)
        return NextResponse.json({ error: 'Unable to adjust booking time.' }, { status: 502 })
      }

      return NextResponse.json({ ok: true, status: 'scheduled' })
    }

    const rpc = action === 'confirm'
      ? 'confirm_booking_request'
      : action === 'reject'
        ? 'reject_booking_request'
        : 'cancel_booking_request'

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
      method: 'POST',
      headers: {
        apikey: secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_request_id: requestId }),
      cache: 'no-store',
    })

    const raw = await response.text()
    if (!response.ok) {
      let message = raw
      try {
        const parsed = JSON.parse(raw)
        message = parsed?.message ?? raw
      } catch {}

      if (message.includes('REQUEST_NOT_PENDING')) {
        return NextResponse.json({ error: 'This request was already processed.' }, { status: 409 })
      }
      if (message.includes('REQUEST_NOT_CONFIRMED')) {
        return NextResponse.json({ error: 'Only a confirmed booking can be cancelled.' }, { status: 409 })
      }
      if (message.includes('REQUEST_NOT_FOUND')) {
        return NextResponse.json({ error: 'Booking request not found.' }, { status: 404 })
      }

      console.error('Booking admin request action error:', response.status, raw)
      return NextResponse.json({ error: 'Unable to update booking request.' }, { status: 502 })
    }

    const status = action === 'confirm' ? 'confirmed' : action === 'reject' ? 'rejected' : 'cancelled'
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    console.error('Booking admin request action API error:', error)
    return NextResponse.json({ error: 'Unable to update booking request.' }, { status: 500 })
  }
}
