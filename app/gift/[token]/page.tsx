import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { getSupabaseServerConfig } from '@/lib/supabase/config'
import '@/app/gift-card.css'

type GiftCardPublic = {
  code: string
  initial_amount_cents: number
  balance_cents: number
  status: 'active' | 'redeemed' | 'void'
  recipient_name: string
  from_name: string | null
  message: string | null
  created_at: string
}

function money(cents: number) {
  return new Intl.NumberFormat('en-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

async function loadGiftCard(token: string): Promise<GiftCardPublic | null> {
  if (!/^[0-9a-f]{48}$/i.test(token)) return null
  const { supabaseUrl, secretKey } = getSupabaseServerConfig()
  const params = new URLSearchParams({
    public_token: `eq.${token}`,
    select: 'code,initial_amount_cents,balance_cents,status,recipient_name,from_name,message,created_at',
    limit: '1',
  })
  const response = await fetch(`${supabaseUrl}/rest/v1/gift_cards?${params.toString()}`, {
    headers: { apikey: secretKey },
    cache: 'no-store',
  })
  if (!response.ok) return null
  const rows = await response.json() as GiftCardPublic[]
  return rows[0] || null
}

export default async function GiftCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const card = await loadGiftCard(token)
  if (!card) notFound()

  const statusText = card.status === 'active' ? 'Active' : card.status === 'redeemed' ? 'Redeemed' : 'Void'

  return (
    <main className="site-shell">
      <SiteHeader />
      <div className="gift-public-page">
        <div className="gift-public-wrap">
          <a className="gift-public-back" href="/">← kisu.tatts</a>
          <section className="gift-certificate">
            <div className="gift-certificate-brand">kisu<i>.tatts</i></div>
            <p className="gift-certificate-label">♡ Gift card</p>
            <div className="gift-certificate-amount">{money(card.initial_amount_cents)}</div>
            <p className="gift-certificate-for">for <strong>{card.recipient_name}</strong>{card.from_name ? <> · from {card.from_name}</> : null}</p>
            {card.message ? <p className="gift-certificate-message">{card.message}</p> : null}
            <div className="gift-certificate-code">
              <span>Gift card code<code>{card.code}</code></span>
              <b className={`gift-certificate-status ${card.status}`}>{statusText}</b>
            </div>
          </section>

          <section className="gift-public-info">
            <h2>Gift card details</h2>
            <p>Remaining balance: <strong>{money(card.balance_cents)}</strong></p>
            <p>Use the code when sending a booking request or show it to Eva. A gift card is a payment method and does not by itself confirm an appointment.</p>
            <div className="gift-public-actions">
              <a href="/booking">Send booking request</a>
              <a href="/">Back to kisu.tatts</a>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
