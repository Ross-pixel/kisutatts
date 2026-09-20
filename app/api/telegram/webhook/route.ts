import { NextResponse } from 'next/server'
import { getSupabaseServerConfig } from '@/lib/supabase/config'
import {
  getTelegramChatId,
  getTelegramWebhookSecret,
  telegramApi,
} from '@/lib/telegram'
import { isTelegramAdminUserId } from '@/lib/telegram-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const BOOKING_ADMIN_URL = 'https://kisutatts.vercel.app/admin/booking'

type TelegramUpdate = {
  message?: {
    message_id: number
    text?: string
    chat: { id: number | string }
    from?: { id: number | string }
  }
  callback_query?: {
    id: string
    data?: string
    from: { id: number | string }
    message?: {
      message_id: number
      text?: string
      chat: { id: number | string }
    }
  }
}

function sameId(a: number | string | undefined, b: string) {
  return a !== undefined && String(a) === b
}

async function answerCallback(callbackQueryId: string, text: string, showAlert = false) {
  try {
    await telegramApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    })
  } catch (error) {
    console.error('Telegram answerCallbackQuery error:', error)
  }
}

async function runBookingAction(action: 'confirm' | 'reject', requestId: string) {
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
      return { ok: false as const, reason: 'already-processed' as const }
    }

    if (message.includes('REQUEST_NOT_FOUND')) {
      return { ok: false as const, reason: 'not-found' as const }
    }

    console.error('Telegram booking action Supabase error:', response.status, raw)
    return { ok: false as const, reason: 'server-error' as const }
  }

  return { ok: true as const }
}

async function handleStart(update: TelegramUpdate) {
  const message = update.message
  if (!message?.text?.startsWith('/start')) return false

  const isAdmin = isTelegramAdminUserId(message.from?.id)

  if (isAdmin) {
    try {
      await telegramApi('setChatMenuButton', {
        chat_id: message.chat.id,
        menu_button: {
          type: 'web_app',
          text: 'Booking admin',
          web_app: { url: BOOKING_ADMIN_URL },
        },
      })
    } catch (error) {
      console.error('Telegram setChatMenuButton error:', error)
    }

    await telegramApi('sendMessage', {
      chat_id: message.chat.id,
      text: 'kisu.tatts booking bot ♡\n\nManage slots and requests from the private admin panel.',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '♡ Booking admin',
            web_app: { url: BOOKING_ADMIN_URL },
          },
        ]],
      },
    })
  } else {
    await telegramApi('sendMessage', {
      chat_id: message.chat.id,
      text: 'kisu.tatts booking bot is connected ♡',
    })
  }

  return true
}

export async function POST(request: Request) {
  const expectedSecret = getTelegramWebhookSecret()
  const suppliedSecret = request.headers.get('x-telegram-bot-api-secret-token') || ''

  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  try {
    if (await handleStart(update)) {
      return NextResponse.json({ ok: true })
    }
  } catch (error) {
    console.error('Telegram /start handler error:', error)
    return NextResponse.json({ ok: true })
  }

  const callback = update.callback_query
  if (!callback?.id || !callback.data || !callback.message) {
    return NextResponse.json({ ok: true })
  }

  const configuredChatId = getTelegramChatId()

  if (!configuredChatId || !sameId(callback.message.chat.id, configuredChatId)) {
    await answerCallback(callback.id, 'This chat is not authorized.', true)
    return NextResponse.json({ ok: true })
  }

  if (!isTelegramAdminUserId(callback.from.id)) {
    await answerCallback(callback.id, 'You are not authorized to manage bookings.', true)
    return NextResponse.json({ ok: true })
  }

  const match = /^(confirm|reject):(.+)$/.exec(callback.data)
  if (!match || !UUID_RE.test(match[2])) {
    await answerCallback(callback.id, 'Invalid booking action.', true)
    return NextResponse.json({ ok: true })
  }

  const action = match[1] as 'confirm' | 'reject'
  const requestId = match[2]
  const result = await runBookingAction(action, requestId)

  if (!result.ok) {
    if (result.reason === 'already-processed') {
      await answerCallback(callback.id, 'This booking was already processed.', true)
    } else if (result.reason === 'not-found') {
      await answerCallback(callback.id, 'Booking request not found.', true)
    } else {
      await answerCallback(callback.id, 'Could not update the booking. Please try again.', true)
    }
    return NextResponse.json({ ok: true })
  }

  const statusLine = action === 'confirm' ? '✅ Confirmed' : '❌ Declined'
  const originalText = callback.message.text?.trim() || 'Booking request'

  try {
    await telegramApi('editMessageText', {
      chat_id: callback.message.chat.id,
      message_id: callback.message.message_id,
      text: `${originalText}\n\n${statusLine}`,
      reply_markup: { inline_keyboard: [] },
    })
  } catch (error) {
    console.error('Telegram editMessageText error:', error)
  }

  await answerCallback(
    callback.id,
    action === 'confirm' ? 'Booking confirmed.' : 'Booking declined and slot released.',
  )

  return NextResponse.json({ ok: true })
}
