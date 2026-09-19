import { NextResponse } from 'next/server'
import { getTelegramAdminFromRequest } from '@/lib/telegram-admin'
import { getSupabaseServerConfig } from '@/lib/supabase/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  if (!getTelegramAdminFromRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const requestId = clean(body?.requestId)
    const action = clean(body?.action)

    if (!UUID_RE.test(requestId) || !['confirm', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid booking action.' }, { status: 400 })
    }

    const { supabaseUrl, secretKey } = getSupabaseServerConfig()
    const rpc = action === 'confirm' ? 'confirm_booking_request' : 'reject_booking_request'
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
      if (message.includes('REQUEST_NOT_FOUND')) {
        return NextResponse.json({ error: 'Booking request not found.' }, { status: 404 })
      }

      console.error('Booking admin request action error:', response.status, raw)
      return NextResponse.json({ error: 'Unable to update booking request.' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, status: action === 'confirm' ? 'confirmed' : 'rejected' })
  } catch (error) {
    console.error('Booking admin request action API error:', error)
    return NextResponse.json({ error: 'Unable to update booking request.' }, { status: 500 })
  }
}
