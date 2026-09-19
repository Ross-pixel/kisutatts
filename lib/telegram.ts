import { BOOKING_REFERENCE_BUCKET } from '@/lib/booking-references'
import { getSupabaseServerConfig } from '@/lib/supabase/config'

type TelegramReplyMarkup = {
  inline_keyboard: Array<Array<{
    text: string
    callback_data: string
  }>>
}

type BookingRequestRow = {
  id: string
  slot_id: string
  name: string
  contact: string
  idea: string
  budget: string | null
}

type BookingSlotRow = {
  id: string
  starts_at: string
  ends_at: string
}

type BookingAttachmentRow = {
  id: string
  storage_path: string
  original_filename: string | null
  mime_type: string | null
  file_size: number | null
  uploaded_at: string | null
}

type DownloadedBookingAttachment = {
  blob: Blob
  filename: string
  mimeType: string
}

function telegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || ''
}

export function getTelegramWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || ''
}

export function getTelegramChatId() {
  return process.env.TELEGRAM_CHAT_ID?.trim() || ''
}

export function getTelegramAdminUserId() {
  return process.env.TELEGRAM_ADMIN_USER_ID?.trim() || ''
}

export function isTelegramConfigured() {
  return Boolean(telegramToken() && getTelegramChatId())
}

function parseTelegramResponse(raw: string) {
  try {
    return JSON.parse(raw) as { ok?: boolean; description?: string; result?: unknown }
  } catch {
    return null
  }
}

export async function telegramApi<T = unknown>(method: string, payload: Record<string, unknown>) {
  const token = telegramToken()
  if (!token) throw new Error('Telegram bot token is not configured')

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  const raw = await response.text()
  const parsed = parseTelegramResponse(raw)

  if (!response.ok || parsed?.ok !== true) {
    throw new Error(parsed?.description || `Telegram ${method} failed with ${response.status}`)
  }

  return parsed.result as T
}

async function telegramMultipartApi<T = unknown>(method: string, body: FormData) {
  const token = telegramToken()
  if (!token) throw new Error('Telegram bot token is not configured')

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    body,
    cache: 'no-store',
  })

  const raw = await response.text()
  const parsed = parseTelegramResponse(raw)

  if (!response.ok || parsed?.ok !== true) {
    throw new Error(parsed?.description || `Telegram ${method} failed with ${response.status}`)
  }

  return parsed.result as T
}

function formatHelsinkiSlot(slot: BookingSlotRow) {
  const start = new Date(slot.starts_at)
  const end = new Date(slot.ends_at)
  const date = new Intl.DateTimeFormat('en-FI', {
    timeZone: 'Europe/Helsinki',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(start)
  const time = new Intl.DateTimeFormat('en-FI', {
    timeZone: 'Europe/Helsinki',
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${date} · ${time.format(start)}–${time.format(end)}`
}

function trimTelegramText(value: string, max = 2200) {
  const text = value.trim()
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function encodeStoragePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

async function loadBookingRequest(requestId: string) {
  const { supabaseUrl, secretKey } = getSupabaseServerConfig()

  const requestParams = new URLSearchParams({
    id: `eq.${requestId}`,
    select: 'id,slot_id,name,contact,idea,budget',
    limit: '1',
  })

  const requestResponse = await fetch(
    `${supabaseUrl}/rest/v1/booking_requests?${requestParams.toString()}`,
    {
      headers: { apikey: secretKey },
      cache: 'no-store',
    },
  )

  if (!requestResponse.ok) {
    throw new Error(`Unable to load booking request: ${requestResponse.status}`)
  }

  const requests = await requestResponse.json() as BookingRequestRow[]
  const booking = requests[0]
  if (!booking) throw new Error('Booking request not found')

  const slotParams = new URLSearchParams({
    id: `eq.${booking.slot_id}`,
    select: 'id,starts_at,ends_at',
    limit: '1',
  })

  const slotResponse = await fetch(
    `${supabaseUrl}/rest/v1/booking_slots?${slotParams.toString()}`,
    {
      headers: { apikey: secretKey },
      cache: 'no-store',
    },
  )

  if (!slotResponse.ok) {
    throw new Error(`Unable to load booking slot: ${slotResponse.status}`)
  }

  const slots = await slotResponse.json() as BookingSlotRow[]
  const slot = slots[0]
  if (!slot) throw new Error('Booking slot not found')

  return { booking, slot }
}

async function claimReferenceNotification(requestId: string) {
  const { supabaseUrl, secretKey } = getSupabaseServerConfig()
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_booking_reference_notification`, {
    method: 'POST',
    headers: {
      apikey: secretKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_request_id: requestId }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Unable to claim booking reference notification: ${response.status}`)
  }

  return await response.json() === true
}

async function releaseReferenceNotification(requestId: string) {
  const { supabaseUrl, secretKey } = getSupabaseServerConfig()
  try {
    await fetch(`${supabaseUrl}/rest/v1/rpc/release_booking_reference_notification`, {
      method: 'POST',
      headers: {
        apikey: secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_request_id: requestId }),
      cache: 'no-store',
    })
  } catch (error) {
    console.error('Unable to release booking reference notification claim:', error)
  }
}

async function loadCompletedBookingAttachments(requestId: string) {
  const { supabaseUrl, secretKey } = getSupabaseServerConfig()
  const params = new URLSearchParams({
    request_id: `eq.${requestId}`,
    uploaded_at: 'not.is.null',
    select: 'id,storage_path,original_filename,mime_type,file_size,uploaded_at',
    order: 'created_at.asc',
  })

  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_attachments?${params.toString()}`,
    {
      headers: { apikey: secretKey },
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    throw new Error(`Unable to load booking attachments: ${response.status}`)
  }

  return await response.json() as BookingAttachmentRow[]
}

async function downloadBookingAttachment(attachment: BookingAttachmentRow): Promise<DownloadedBookingAttachment> {
  const { supabaseUrl, secretKey } = getSupabaseServerConfig()
  const signResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${BOOKING_REFERENCE_BUCKET}/${encodeStoragePath(attachment.storage_path)}`,
    {
      method: 'POST',
      headers: {
        apikey: secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 120 }),
      cache: 'no-store',
    },
  )

  const signRaw = await signResponse.text()
  if (!signResponse.ok) {
    throw new Error(`Unable to sign booking attachment download: ${signResponse.status} ${signRaw}`)
  }

  const signed = JSON.parse(signRaw) as { signedURL?: string; signedUrl?: string }
  const path = signed.signedURL || signed.signedUrl
  if (!path) throw new Error('Storage did not return a signed download URL')

  const signedUrl = path.startsWith('http') ? path : `${supabaseUrl}/storage/v1${path}`
  const downloadResponse = await fetch(signedUrl, { cache: 'no-store' })
  if (!downloadResponse.ok) {
    throw new Error(`Unable to download booking attachment: ${downloadResponse.status}`)
  }

  const bytes = await downloadResponse.arrayBuffer()
  const mimeType = attachment.mime_type?.trim() || downloadResponse.headers.get('content-type') || 'application/octet-stream'
  const filename = attachment.original_filename?.trim() || attachment.storage_path.split('/').pop() || 'reference'

  return {
    blob: new Blob([bytes], { type: mimeType }),
    filename,
    mimeType,
  }
}

function isTelegramPhoto(attachment: DownloadedBookingAttachment) {
  return attachment.mimeType === 'image/jpeg'
    || attachment.mimeType === 'image/png'
    || attachment.mimeType === 'image/webp'
}

async function sendSingleTelegramAttachment(
  chatId: string,
  attachment: DownloadedBookingAttachment,
  caption: string,
) {
  if (isTelegramPhoto(attachment)) {
    const photoBody = new FormData()
    photoBody.append('chat_id', chatId)
    photoBody.append('caption', trimTelegramText(caption, 1000))
    photoBody.append('photo', attachment.blob, attachment.filename)

    try {
      await telegramMultipartApi('sendPhoto', photoBody)
      return
    } catch (error) {
      console.warn('Telegram sendPhoto failed; retrying as document:', error)
    }
  }

  const documentBody = new FormData()
  documentBody.append('chat_id', chatId)
  documentBody.append('caption', trimTelegramText(caption, 1000))
  documentBody.append('document', attachment.blob, attachment.filename)
  await telegramMultipartApi('sendDocument', documentBody)
}

async function sendTelegramAlbum(
  chatId: string,
  attachments: DownloadedBookingAttachment[],
  type: 'photo' | 'document',
) {
  if (attachments.length < 2) {
    const attachment = attachments[0]
    if (attachment) {
      await sendSingleTelegramAttachment(chatId, attachment, `Reference · ${attachment.filename}`)
    }
    return
  }

  const body = new FormData()
  body.append('chat_id', chatId)

  const media = attachments.map((attachment, index) => {
    const field = `file${index}`
    body.append(field, attachment.blob, attachment.filename)
    return {
      type,
      media: `attach://${field}`,
      ...(index === 0 ? { caption: `Reference ${type === 'photo' ? 'photos' : 'files'} · ${attachments.length}` } : {}),
    }
  })

  body.append('media', JSON.stringify(media))
  await telegramMultipartApi('sendMediaGroup', body)
}

async function sendReferenceGroup(
  chatId: string,
  attachments: DownloadedBookingAttachment[],
  type: 'photo' | 'document',
) {
  if (attachments.length === 0) return

  try {
    await sendTelegramAlbum(chatId, attachments, type)
  } catch (error) {
    console.warn(`Telegram ${type} album failed; retrying attachments individually:`, error)
    for (let index = 0; index < attachments.length; index += 1) {
      await sendSingleTelegramAttachment(
        chatId,
        attachments[index],
        `Reference ${index + 1}/${attachments.length} · ${attachments[index].filename}`,
      )
    }
  }
}

export async function sendBookingTelegramNotification(requestId: string) {
  const chatId = getTelegramChatId()
  if (!telegramToken() || !chatId) return { skipped: true as const }

  const { booking, slot } = await loadBookingRequest(requestId)
  const budget = booking.budget?.trim() || 'Not specified'
  const text = [
    '♡ New booking request',
    '',
    `Name: ${booking.name}`,
    `Contact: ${booking.contact}`,
    `Date: ${formatHelsinkiSlot(slot)}`,
    `Budget: ${budget}`,
    '',
    'Idea:',
    trimTelegramText(booking.idea),
    '',
    'Reference photos will follow in chat if attached.',
  ].join('\n')

  const replyMarkup: TelegramReplyMarkup = {
    inline_keyboard: [[
      { text: '✓ Confirm', callback_data: `confirm:${booking.id}` },
      { text: '✕ Decline', callback_data: `reject:${booking.id}` },
    ]],
  }

  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
  })

  return { skipped: false as const }
}

export async function sendBookingReferenceTelegramAttachments(requestId: string) {
  const chatId = getTelegramChatId()
  if (!telegramToken() || !chatId) return { skipped: true as const, reason: 'telegram-not-configured' as const }

  const claimed = await claimReferenceNotification(requestId)
  if (!claimed) return { skipped: true as const, reason: 'not-ready-or-already-sent' as const }

  try {
    const attachments = await loadCompletedBookingAttachments(requestId)
    if (attachments.length === 0) {
      await releaseReferenceNotification(requestId)
      return { skipped: true as const, reason: 'no-attachments' as const }
    }

    const downloaded: DownloadedBookingAttachment[] = []
    for (const attachment of attachments) {
      downloaded.push(await downloadBookingAttachment(attachment))
    }

    const photos = downloaded.filter(isTelegramPhoto)
    const documents = downloaded.filter((attachment) => !isTelegramPhoto(attachment))

    await sendReferenceGroup(chatId, photos, 'photo')
    await sendReferenceGroup(chatId, documents, 'document')

    return { skipped: false as const, count: attachments.length }
  } catch (error) {
    await releaseReferenceNotification(requestId)
    throw error
  }
}
