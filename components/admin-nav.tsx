'use client'

type AdminNavProps = {
  active: 'booking' | 'gift-cards'
}

export function AdminNav({ active }: AdminNavProps) {
  return (
    <nav className="admin-app-nav" aria-label="Admin sections">
      <a className={active === 'booking' ? 'active' : ''} href="/admin/booking">Calendar & bookings</a>
      <a className={active === 'gift-cards' ? 'active' : ''} href="/admin/gift-cards">♡ Gift cards</a>
    </nav>
  )
}
