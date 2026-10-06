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
  // Merge the modern allowlist with the legacy single-admin value. This lets us
  // add Eva without risking loss of the original technical-admin access while
  // production environment variables are migrated.
  return Array.from(new Set([
    ...parseTelegramIds(process.env.TELEGRAM_ADMIN_USER_IDS),
    ...parseTelegramIds(process.env.TELEGRAM_ADMIN_USER_ID),
  ]))
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
