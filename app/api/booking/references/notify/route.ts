import { NextResponse } from 'next/server'
import { sendBookingReferenceTelegramAttachments } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : ''

    if (!UUID_RE.test(requestId)) {
      return NextResponse.json({ error: 'Invalid booking request.' }, { status: 400 })
    }

    const result = await sendBookingReferenceTelegramAttachments(requestId)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Telegram booking reference notification error:', error)
    return NextResponse.json(
      { error: 'Unable to send booking references to Telegram.' },
      { status: 502 },
    )
  }
}
