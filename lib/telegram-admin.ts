import { createHmac, timingSafeEqual } from 'crypto'
import { getTelegramAdminUserId } from '@/lib/telegram'

type TelegramWebAppUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
}

export type TelegramAdminIdentity = {
  user: TelegramWebAppUser
  authDate: number
}

const MAX_INIT_DATA_AGE_SECONDS = 6 * 60 * 60

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || ''
}

export function verifyTelegramAdminInitData(initData: string): TelegramAdminIdentity | null {
  const token = botToken()
  const configuredAdminId = getTelegramAdminUserId()
  if (!token || !configuredAdminId || !initData) return null

  const params = new URLSearchParams(initData)
  const suppliedHash = params.get('hash') || ''
  const authDateRaw = params.get('auth_date') || ''
  const userRaw = params.get('user') || ''

  if (!/^[0-9a-f]{64}$/i.test(suppliedHash) || !/^\d+$/.test(authDateRaw) || !userRaw) {
    return null
  }

  params.delete('hash')
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest()
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const supplied = Buffer.from(suppliedHash, 'hex')
  const calculated = Buffer.from(calculatedHash, 'hex')
  if (supplied.length !== calculated.length || !timingSafeEqual(supplied, calculated)) {
    return null
  }

  const authDate = Number(authDateRaw)
  const now = Math.floor(Date.now() / 1000)
  if (!Number.isFinite(authDate) || authDate > now + 30 || now - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    return null
  }

  let user: TelegramWebAppUser
  try {
    user = JSON.parse(userRaw) as TelegramWebAppUser
  } catch {
    return null
  }

  if (!user || String(user.id) !== configuredAdminId) return null

  return { user, authDate }
}

export function getTelegramAdminFromRequest(request: Request) {
  const initData = request.headers.get('x-telegram-init-data') || ''
  return verifyTelegramAdminInitData(initData)
}
