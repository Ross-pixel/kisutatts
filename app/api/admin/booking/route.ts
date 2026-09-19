import { NextResponse } from 'next/server'
import { getTelegramAdminFromRequest } from '@/lib/telegram-admin'
import { getSupabaseServerConfig } from '@/lib/supabase/config'
import { BOOKING_REFERENCE_BUCKET } from '@/lib/booking-references'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type BookingAttachmentRow = {
  id: string
  request_id: string
  storage_path: string
  original_filename: string | null
  mime_type: string | null
  file_size: number | null
  uploaded_at: string | null
}

type BookingDayTemplateSlotRow = {
  id: string
  template_id: string
  start_time: string
  end_time: string
  status: string
  note: string | null
}

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

function encodeStoragePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

async function signAttachment(
  supabaseUrl: string,
  secretKey: string,
  attachment: BookingAttachmentRow,
) {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${BOOKING_REFERENCE_BUCKET}/${encodeStoragePath(attachment.storage_path)}`,
    {
      method: 'POST',
      headers: {
        apikey: secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 600 }),
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    console.error('Unable to sign admin booking reference:', response.status, await response.text())
    return null
  }

  const signed = await response.json() as { signedURL?: string; signedUrl?: string }
  const path = signed.signedURL || signed.signedUrl
  if (!path) return null

  return {
    id: attachment.id,
    originalFilename: attachment.original_filename || 'reference',
    mimeType: attachment.mime_type || 'application/octet-stream',
    fileSize: attachment.file_size,
    signedUrl: path.startsWith('http') ? path : `${supabaseUrl}/storage/v1${path}`,
  }
}

export async function GET(request: Request) {
  const identity = getTelegramAdminFromRequest(request)
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { supabaseUrl, secretKey } = getSupabaseServerConfig()
    const [slots, requests, attachments, templates, templateSlots] = await Promise.all([
      loadJson(
        `${supabaseUrl}/rest/v1/booking_slots?select=id,starts_at,ends_at,status,note,created_at,updated_at&order=starts_at.asc`,
        secretKey,
      ),
      loadJson(
        `${supabaseUrl}/rest/v1/booking_requests?select=id,slot_id,name,contact,idea,budget,status,requested_starts_at,requested_ends_at,scheduled_starts_at,scheduled_ends_at,created_at,updated_at&order=created_at.desc&limit=100`,
        secretKey,
      ),
      loadJson(
        `${supabaseUrl}/rest/v1/booking_attachments?select=id,request_id,storage_path,original_filename,mime_type,file_size,uploaded_at&uploaded_at=not.is.null&order=created_at.asc`,
        secretKey,
      ),
      loadJson(
        `${supabaseUrl}/rest/v1/booking_day_templates?select=id,name,source_date,created_at&order=name.asc`,
        secretKey,
      ),
      loadJson(
        `${supabaseUrl}/rest/v1/booking_day_template_slots?select=id,template_id,start_time,end_time,status,note&order=start_time.asc`,
        secretKey,
      ),
    ])

    const activeRequestIds = new Set(
      (requests as Array<{ id: string; status: string }>)
        .filter((item) => item.status === 'pending' || item.status === 'confirmed')
        .map((item) => item.id),
    )

    const attachmentEntries = await Promise.all(
      (attachments as BookingAttachmentRow[])
        .filter((attachment) => activeRequestIds.has(attachment.request_id))
        .map(async (attachment) => [
          attachment.request_id,
          await signAttachment(supabaseUrl, secretKey, attachment),
        ] as const),
    )

    const attachmentsByRequest = new Map<string, Array<Record<string, unknown>>>()
    for (const [requestId, attachment] of attachmentEntries) {
      if (!attachment) continue
      const current = attachmentsByRequest.get(requestId) || []
      current.push(attachment)
      attachmentsByRequest.set(requestId, current)
    }

    const templateSlotsByTemplate = new Map<string, BookingDayTemplateSlotRow[]>()
    for (const item of templateSlots as BookingDayTemplateSlotRow[]) {
      const current = templateSlotsByTemplate.get(item.template_id) || []
      current.push(item)
      templateSlotsByTemplate.set(item.template_id, current)
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
        attachments: attachmentsByRequest.get(item.id) || [],
      })),
      templates: (templates as Array<Record<string, unknown> & { id: string }>).map((template) => ({
        ...template,
        slots: templateSlotsByTemplate.get(template.id) || [],
      })),
    })
  } catch (error) {
    console.error('Booking admin overview error:', error)
    return NextResponse.json({ error: 'Unable to load booking admin.' }, { status: 502 })
  }
}
