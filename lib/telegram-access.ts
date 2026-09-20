function parseTelegramIds(value: string | undefined) {
  if (!value) return []

  return Array.from(new Set(
    value
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  ))
}

export function getTelegramAdminUserIds() {
  const configured = parseTelegramIds(process.env.TELEGRAM_ADMIN_USER_IDS)
  if (configured.length > 0) return configured

  // Backwards compatibility while the production env is migrated.
  return parseTelegramIds(process.env.TELEGRAM_ADMIN_USER_ID)
}

export function isTelegramAdminUserId(userId: number | string | undefined) {
  if (userId === undefined) return false
  const id = String(userId)
  return getTelegramAdminUserIds().includes(id)
}

export function getTelegramReminderChatId() {
  // Reminders are intentionally independent from admin access. When reminders
  // are enabled, point this at Eva's private chat without affecting other admins.
  return process.env.TELEGRAM_REMINDER_CHAT_ID?.trim()
    || process.env.TELEGRAM_CHAT_ID?.trim()
    || ''
}
