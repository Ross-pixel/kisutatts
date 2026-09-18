import { NextResponse } from 'next/server'
import {
  getTelegramAdminUserId,
  getTelegramChatId,
  getTelegramWebhookSecret,
  telegramApi,
} from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const expectedSecret = getTelegramWebhookSecret()
  const suppliedSecret = request.headers.get('x-telegram-bot-api-secret-token') || ''

  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const chatId = getTelegramChatId()
  const adminUserId = getTelegramAdminUserId()

  if (!chatId) {
    return NextResponse.json({
      ok: false,
      chatIdConfigured: false,
      adminUserIdConfigured: Boolean(adminUserId),
      message: 'TELEGRAM_CHAT_ID is not available in this deployment.',
    }, { status: 500 })
  }

  try {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: 'kisu.tatts Telegram test ♡\n\nOutgoing notifications from Vercel are working.',
    })

    return NextResponse.json({
      ok: true,
      chatIdConfigured: true,
      adminUserIdConfigured: Boolean(adminUserId),
      messageSent: true,
    })
  } catch (error) {
    console.error('Telegram diagnostics error:', error)
    return NextResponse.json({
      ok: false,
      chatIdConfigured: true,
      adminUserIdConfigured: Boolean(adminUserId),
      messageSent: false,
      error: error instanceof Error ? error.message : 'Telegram test failed.',
    }, { status: 502 })
  }
}
