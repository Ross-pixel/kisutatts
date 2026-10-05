import Script from 'next/script'
import { AdminNav } from '@/components/admin-nav'
import { BookingAdmin } from '@/components/booking-admin'
import { BookingAdminBehaviorFixes } from '@/components/booking-admin-behavior-fixes'
import { BookingAdminPrivateTools } from '@/components/booking-admin-private-tools'
import '@/app/admin-booking.css'
import '@/app/admin-booking-extra.css'
import '@/app/admin-booking-mobile-fixes.css'
import '@/app/admin-gift-cards.css'

export default function BookingAdminPage() {
  return (
    <main className="admin-page">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <BookingAdminBehaviorFixes />
      <AdminNav active="booking" />
      <BookingAdmin />
      <div className="booking-admin admin-private-wrap">
        <BookingAdminPrivateTools />
      </div>
    </main>
  )
}
