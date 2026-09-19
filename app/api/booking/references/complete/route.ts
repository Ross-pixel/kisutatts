import { NextResponse } from 'next/server'
import { getSupabaseServerConfig } from '@/lib/supabase/config'
import { sendBookingReferenceTelegramAttachments } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : ''
    const attachmentId = typeof body?.attachmentId === 'string' ? body.attachmentId.trim() : ''
    const storagePath = typeof body?.storagePath === 'string' ? body.storagePath.trim() : ''

    if (!UUID_RE.test(requestId) || !UUID_RE.test(attachmentId)) {
      return NextResponse.json({ error: 'Invalid reference upload.' }, { status: 400 })
    }

    if (!storagePath.startsWith(`${requestId}/${attachmentId}.`)) {
      return NextResponse.json({ error: 'Invalid reference upload path.' }, { status: 400 })
    }

    const { supabaseUrl, secretKey } = getSupabaseServerConfig()

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/complete_booking_attachment`, {
      method: 'POST',
      headers: {
        apikey: secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_request_id: requestId,
        p_attachment_id: attachmentId,
        p_storage_path: storagePath,
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Complete booking attachment error:', response.status, detail)

      if (detail.includes('FILE_NOT_FOUND')) {
        return NextResponse.json({ error: 'The uploaded file could not be verified.' }, { status: 409 })
      }

      return NextResponse.json({ error: 'Unable to finish reference upload.' }, { status: 502 })
    }

    // The claim inside this helper succeeds only after every prepared reference
    // for the booking has finished uploading. Earlier completion calls are cheap no-ops.
    // Telegram is auxiliary: a delivery failure must not invalidate a stored reference.
    try {
      await sendBookingReferenceTelegramAttachments(requestId)
    } catch (error) {
      console.error('Telegram booking reference delivery error:', error)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Booking reference completion API error:', error)
    return NextResponse.json({ error: 'Unable to finish reference upload.' }, { status: 500 })
  }
}
