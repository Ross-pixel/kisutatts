import { NextResponse } from 'next/server'
import { getSupabaseServerConfig } from '@/lib/supabase/config'
import {
  BOOKING_REFERENCE_BUCKET,
  MAX_REFERENCE_FILE_SIZE,
  MAX_REFERENCE_FILES,
  REFERENCE_MIME_EXTENSIONS,
  normalizeReferenceMime,
} from '@/lib/booking-references'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function encodeStoragePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

async function cleanupPrepared(
  supabaseUrl: string,
  secretKey: string,
  requestId: string,
  attachmentIds: string[],
) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/rpc/discard_prepared_booking_attachments`, {
      method: 'POST',
      headers: {
        apikey: secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_request_id: requestId,
        p_attachment_ids: attachmentIds,
      }),
      cache: 'no-store',
    })
  } catch (error) {
    console.error('Unable to clean prepared booking attachments:', error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : ''
    const files = Array.isArray(body?.files) ? body.files : []

    if (!UUID_RE.test(requestId)) {
      return NextResponse.json({ error: 'Invalid booking request.' }, { status: 400 })
    }

    if (files.length < 1 || files.length > MAX_REFERENCE_FILES) {
      return NextResponse.json(
        { error: `Choose between 1 and ${MAX_REFERENCE_FILES} reference images.` },
        { status: 400 },
      )
    }

    const preparedItems = files.map((file: unknown) => {
      const value = file && typeof file === 'object' ? file as Record<string, unknown> : {}
      const originalFilename = typeof value.name === 'string' ? value.name.trim() : ''
      const rawMime = typeof value.type === 'string' ? value.type : ''
      const size = typeof value.size === 'number' ? value.size : Number(value.size)
      const mime = normalizeReferenceMime(originalFilename, rawMime)

      if (!originalFilename || originalFilename.length > 255) {
        throw new Error('INVALID_FILENAME')
      }

      if (!mime) {
        throw new Error('INVALID_FILE_TYPE')
      }

      if (!Number.isFinite(size) || size <= 0 || size > MAX_REFERENCE_FILE_SIZE) {
        throw new Error('INVALID_FILE_SIZE')
      }

      const attachmentId = crypto.randomUUID()
      const extension = REFERENCE_MIME_EXTENSIONS[mime]

      return {
        attachment_id: attachmentId,
        storage_path: `${requestId}/${attachmentId}.${extension}`,
        original_filename: originalFilename,
        mime_type: mime,
        file_size: Math.trunc(size),
      }
    })

    const { supabaseUrl, secretKey } = getSupabaseServerConfig()

    const prepareResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/prepare_booking_attachments`, {
      method: 'POST',
      headers: {
        apikey: secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_request_id: requestId,
        p_items: preparedItems,
      }),
      cache: 'no-store',
    })

    if (!prepareResponse.ok) {
      const detail = await prepareResponse.text()
      console.error('Prepare booking attachments error:', prepareResponse.status, detail)

      if (detail.includes('TOO_MANY_ATTACHMENTS')) {
        return NextResponse.json({ error: 'This booking already has the maximum number of reference images.' }, { status: 409 })
      }

      if (detail.includes('BOOKING_REQUEST_NOT_AVAILABLE')) {
        return NextResponse.json({ error: 'This booking request can no longer accept uploads.' }, { status: 409 })
      }

      return NextResponse.json({ error: 'Unable to prepare reference uploads.' }, { status: 502 })
    }

    const attachmentIds = preparedItems.map((item) => item.attachment_id)

    try {
      const uploads = []

      for (const item of preparedItems) {
        const storageResponse = await fetch(
          `${supabaseUrl}/storage/v1/object/upload/sign/${BOOKING_REFERENCE_BUCKET}/${encodeStoragePath(item.storage_path)}`,
          {
            method: 'POST',
            headers: {
              apikey: secretKey,
              'Content-Type': 'application/json',
            },
            body: '{}',
            cache: 'no-store',
          },
        )

        const raw = await storageResponse.text()

        if (!storageResponse.ok) {
          throw new Error(`Storage signed upload error ${storageResponse.status}: ${raw}`)
        }

        const payload = JSON.parse(raw) as { url?: string }
        if (!payload.url) {
          throw new Error('Storage did not return a signed upload URL.')
        }

        const signedUrl = payload.url.startsWith('http')
          ? payload.url
          : `${supabaseUrl}/storage/v1${payload.url}`

        uploads.push({
          attachmentId: item.attachment_id,
          storagePath: item.storage_path,
          signedUrl,
          mimeType: item.mime_type,
        })
      }

      return NextResponse.json({ uploads })
    } catch (error) {
      await cleanupPrepared(supabaseUrl, secretKey, requestId, attachmentIds)
      console.error('Signed booking reference URL error:', error)
      return NextResponse.json({ error: 'Unable to prepare reference uploads.' }, { status: 502 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    if (message === 'INVALID_FILENAME') {
      return NextResponse.json({ error: 'One of the selected filenames is invalid.' }, { status: 400 })
    }

    if (message === 'INVALID_FILE_TYPE') {
      return NextResponse.json({ error: 'Reference images must be JPEG, PNG, WebP, HEIC or HEIF.' }, { status: 400 })
    }

    if (message === 'INVALID_FILE_SIZE') {
      return NextResponse.json({ error: 'Each reference image must be 10 MB or smaller.' }, { status: 400 })
    }

    console.error('Booking reference signing API error:', error)
    return NextResponse.json({ error: 'Unable to prepare reference uploads.' }, { status: 500 })
  }
}
