import { NextResponse } from 'next/server'
import { getTelegramAdminFromRequest } from '@/lib/telegram-admin'
import { getSupabaseServerConfig } from '@/lib/supabase/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function loadJson(url: string, secretKey: string) {
  const response = await fetch(url, {
    headers: { apikey: secretKey },
    cache: 'no-store',
  })
  const raw = await response.text()
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${raw}`)
  }
  return JSON.parse(raw)
}

export async function GET(request: Request) {
  const identity = getTelegramAdminFromRequest(request)
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { supabaseUrl, secretKey } = getSupabaseServerConfig()
    const [slots, requests, attachments] = await Promise.all([
      loadJson(
        `${supabaseUrl}/rest/v1/booking_slots?select=id,starts_at,ends_at,status,note,created_at,updated_at&order=starts_at.asc`,
        secretKey,
      ),
      loadJson(
        `${supabaseUrl}/rest/v1/booking_requests?select=id,slot_id,name,contact,idea,budget,status,created_at,updated_at&order=created_at.desc&limit=100`,
        secretKey,
      ),
      loadJson(
        `${supabaseUrl}/rest/v1/booking_attachments?select=id,request_id,original_filename,mime_type,file_size,uploaded_at&uploaded_at=not.is.null&order=created_at.asc`,
        secretKey,
      ),
    ])

    const attachmentCounts = new Map<string, number>()
    for (const attachment of attachments as Array<{ request_id: string }>) {
      attachmentCounts.set(
        attachment.request_id,
        (attachmentCounts.get(attachment.request_id) || 0) + 1,
      )
    }

    return NextResponse.json({
      admin: {
        id: identity.user.id,
        firstName: identity.user.first_name || '',
        username: identity.user.username || '',
      },
      slots,
      requests: (requests as Array<Record<string, unknown> & { id: string }>).map((item) => ({
        ...item,
        attachmentCount: attachmentCounts.get(item.id) || 0,
      })),
    })
  } catch (error) {
    console.error('Booking admin overview error:', error)
    return NextResponse.json({ error: 'Unable to load booking admin.' }, { status: 502 })
  }
}
