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
  let parsed: any = null

  try {
    parsed = JSON.parse(raw)
  } catch {}

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
    'Reference photos, if attached, are stored privately with the request.',
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
