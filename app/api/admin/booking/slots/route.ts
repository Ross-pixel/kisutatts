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

async function supabaseWrite(path: string, secretKey: string, init: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      apikey: secretKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })
  const raw = await response.text()
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${raw}`)
  return raw ? JSON.parse(raw) : null
}

export async function POST(request: Request) {
  if (!getTelegramAdminFromRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const date = clean(body?.date)
    const startTime = clean(body?.startTime)
    const endTime = clean(body?.endTime)
    const note = clean(body?.note)
    const status = body?.status === 'blocked' ? 'blocked' : 'available'

    const startsAt = helsinkiLocalToUtc(date, startTime)
    const endsAt = helsinkiLocalToUtc(date, endTime)
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      return NextResponse.json({ error: 'Check the date and time range.' }, { status: 400 })
    }

    const { supabaseUrl, secretKey } = getSupabaseServerConfig()
    const rows = await supabaseWrite(`${supabaseUrl}/rest/v1/booking_slots`, secretKey, {
      method: 'POST',
      body: JSON.stringify({
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status,
        note: note || null,
      }),
    })

    return NextResponse.json({ ok: true, slot: Array.isArray(rows) ? rows[0] : rows })
  } catch (error) {
    console.error('Booking admin slot create error:', error)
    return NextResponse.json({ error: 'Unable to create slot.' }, { status: 502 })
  }
}

export async function PATCH(request: Request) {
  if (!getTelegramAdminFromRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const id = clean(body?.id)
    const status = clean(body?.status)
    if (!UUID_RE.test(id) || !['available', 'blocked'].includes(status)) {
      return NextResponse.json({ error: 'Invalid slot update.' }, { status: 400 })
    }

    const { supabaseUrl, secretKey } = getSupabaseServerConfig()
    const rows = await supabaseWrite(
      `${supabaseUrl}/rest/v1/booking_slots?id=eq.${encodeURIComponent(id)}&status=in.(available,blocked)`,
      secretKey,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    )

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'This slot can no longer be changed.' }, { status: 409 })
    }

    return NextResponse.json({ ok: true, slot: rows[0] })
  } catch (error) {
    console.error('Booking admin slot update error:', error)
    return NextResponse.json({ error: 'Unable to update slot.' }, { status: 502 })
  }
}

export async function DELETE(request: Request) {
  if (!getTelegramAdminFromRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const id = clean(url.searchParams.get('id'))
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid slot.' }, { status: 400 })
    }

    const { supabaseUrl, secretKey } = getSupabaseServerConfig()
    const rows = await supabaseWrite(
      `${supabaseUrl}/rest/v1/booking_slots?id=eq.${encodeURIComponent(id)}&status=in.(available,blocked)`,
      secretKey,
      { method: 'DELETE' },
    )

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Only unused available/blocked slots can be deleted.' }, { status: 409 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Booking admin slot delete error:', error)
    return NextResponse.json({ error: 'Unable to delete slot.' }, { status: 502 })
  }
}
