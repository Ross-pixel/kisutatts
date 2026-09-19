import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { BOOKING_REFERENCE_BUCKET } from '@/lib/booking-references'
import { getSupabaseServerConfig } from '@/lib/supabase/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BATCH_SIZE = 50

type RetentionRequest = {
  id: string
  status: 'rejected' | 'cancelled' | 'completed'
  updated_at: string
  scheduled_ends_at: string
}

type AttachmentRow = {
  request_id: string
  storage_path: string
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || ''
  if (!secret) return false

  const expected = `Bearer ${secret}`
  const actual = request.headers.get('authorization') || ''
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)

  return expectedBuffer.length === actualBuffer.length
    && timingSafeEqual(expectedBuffer, actualBuffer)
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

async function deleteStorageObjects(
  supabaseUrl: string,
  secretKey: string,
  paths: string[],
) {
  if (paths.length === 0) return

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${BOOKING_REFERENCE_BUCKET}`, {
    method: 'DELETE',
    headers: {
      apikey: secretKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: paths }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Storage cleanup failed: ${response.status} ${await response.text()}`)
  }
}

async function purgeRequest(supabaseUrl: string, secretKey: string, requestId: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/purge_booking_request_after_retention`, {
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
    try { message = JSON.parse(raw)?.message ?? raw } catch {}
    if (message.includes('RETENTION_NOT_DUE')) return false
    throw new Error(`Retention purge failed: ${response.status} ${raw}`)
  }

  return JSON.parse(raw) === true
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    console.error('CRON_SECRET is not configured; retention cleanup is disabled.')
    return NextResponse.json({ error: 'Retention cleanup is not configured.' }, { status: 503 })
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { supabaseUrl, secretKey } = getSupabaseServerConfig()
    const cutoffCancelled = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
    const cutoffCompleted = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

    const filter = `or=(and(status.in.(rejected,cancelled),updated_at.lte.${cutoffCancelled}),and(status.eq.completed,scheduled_ends_at.lte.${cutoffCompleted}))`
    const candidates = await loadJson<RetentionRequest[]>(
      `${supabaseUrl}/rest/v1/booking_requests?select=id,status,updated_at,scheduled_ends_at&${filter}&order=updated_at.asc&limit=${BATCH_SIZE}`,
      secretKey,
    )

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, scanned: 0, purged: 0, failed: 0 })
    }

    const ids = candidates.map((item) => item.id)
    const attachments = await loadJson<AttachmentRow[]>(
      `${supabaseUrl}/rest/v1/booking_attachments?select=request_id,storage_path&request_id=in.(${ids.join(',')})`,
      secretKey,
    )

    const pathsByRequest = new Map<string, string[]>()
    for (const attachment of attachments) {
      const current = pathsByRequest.get(attachment.request_id) || []
      current.push(attachment.storage_path)
      pathsByRequest.set(attachment.request_id, current)
    }

    let purged = 0
    let failed = 0
    const errors: Array<{ requestId: string; error: string }> = []

    for (const candidate of candidates) {
      try {
        await deleteStorageObjects(
          supabaseUrl,
          secretKey,
          pathsByRequest.get(candidate.id) || [],
        )
        if (await purgeRequest(supabaseUrl, secretKey, candidate.id)) purged += 1
      } catch (error) {
        failed += 1
        errors.push({
          requestId: candidate.id,
          error: error instanceof Error ? error.message : 'Unknown cleanup error',
        })
      }
    }

    if (errors.length > 0) {
      console.error('Booking retention cleanup errors:', errors)
    }

    return NextResponse.json({
      ok: failed === 0,
      scanned: candidates.length,
      purged,
      failed,
    }, { status: failed === 0 ? 200 : 207 })
  } catch (error) {
    console.error('Booking retention cron error:', error)
    return NextResponse.json({ error: 'Retention cleanup failed.' }, { status: 500 })
  }
}
