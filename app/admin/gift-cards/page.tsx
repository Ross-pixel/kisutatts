import Script from 'next/script'
import { AdminNav } from '@/components/admin-nav'
import { GiftCardAdmin } from '@/components/gift-card-admin'
import '@/app/admin-booking.css'
import '@/app/admin-gift-cards.css'

export default function GiftCardAdminPage() {
  return (
    <main className="admin-page">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <AdminNav active="gift-cards" />
      <GiftCardAdmin />
    </main>
  )
}
