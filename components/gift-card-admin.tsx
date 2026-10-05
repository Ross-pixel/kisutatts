'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type GiftCardStatus = 'active' | 'redeemed' | 'void'

type GiftCard = {
  id: string
  code: string
  public_token: string
  initial_amount_cents: number
  balance_cents: number
  status: GiftCardStatus
  recipient_name: string
  from_name: string | null
  message: string | null
  buyer_contact: string | null
  internal_note: string | null
  created_at: string
  updated_at: string
  voided_at: string | null
}

type GiftCardTransaction = {
  id: string
  gift_card_id: string
  kind: 'issued' | 'redeemed' | 'adjustment' | 'voided'
  amount_cents: number
  note: string | null
  booking_request_id: string | null
  created_by_telegram_id: string | null
  created_at: string
}

type GiftCardPayload = {
  admin: { id: number; firstName: string; username: string }
  cards: GiftCard[]
  transactions: GiftCardTransaction[]
}

function money(cents: number) {
  return new Intl.NumberFormat('en-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-FI', {
    timeZone: 'Europe/Helsinki',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function centsFromInput(value: FormDataEntryValue | null) {
  const amount = Number(String(value || '').replace(',', '.'))
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100)
}

export function GiftCardAdmin() {
  const [initData, setInitData] = useState('')
  const [payload, setPayload] = useState<GiftCardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | GiftCardStatus>('all')
  const [createdCard, setCreatedCard] = useState<{ code: string; public_token: string } | null>(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    let attempts = 0
    const readTelegram = () => {
      const webApp = (window as any).Telegram?.WebApp
      const data = webApp?.initData || ''
      if (data) {
        webApp?.ready?.()
        webApp?.expand?.()
        webApp?.setHeaderColor?.('#fdfbf7')
        webApp?.setBackgroundColor?.('#fdfbf7')
        setInitData(data)
        return
      }
      attempts += 1
      if (attempts < 30) window.setTimeout(readTelegram, 100)
      else setLoading(false)
    }
    readTelegram()
  }, [])

  async function load(data = initData) {
    if (!data) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/gift-cards', {
        headers: { 'x-telegram-init-data': data },
        cache: 'no-store',
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Unable to load gift cards.')
      setPayload(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load gift cards.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initData) void load(initData)
  }, [initData])

  const transactionsByCard = useMemo(() => {
    const map = new Map<string, GiftCardTransaction[]>()
    for (const transaction of payload?.transactions || []) {
      const current = map.get(transaction.gift_card_id) || []
      current.push(transaction)
      map.set(transaction.gift_card_id, current)
    }
    return map
  }, [payload])

  const filteredCards = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (payload?.cards || []).filter((card) => {
      if (statusFilter !== 'all' && card.status !== statusFilter) return false
      if (!needle) return true
      return [card.code, card.recipient_name, card.from_name, card.buyer_contact]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [payload, query, statusFilter])

  async function post(body: Record<string, unknown>) {
    const response = await fetch('/api/admin/gift-cards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': initData,
      },
      body: JSON.stringify(body),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result?.error || 'Unable to update gift card.')
    return result
  }

  async function createCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!initData) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const amountCents = centsFromInput(form.get('amount'))

    setBusy(true)
    setError('')
    try {
      const result = await post({
        action: 'create',
        amountCents,
        recipientName: form.get('recipientName'),
        fromName: form.get('fromName'),
        message: form.get('message'),
        buyerContact: form.get('buyerContact'),
        internalNote: form.get('internalNote'),
      })
      setCreatedCard(result.card)
      formElement.reset()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create gift card.')
    } finally {
      setBusy(false)
    }
  }

  async function redeemCard(event: FormEvent<HTMLFormElement>, card: GiftCard) {
    event.preventDefault()
    if (!initData) return
    const form = new FormData(event.currentTarget)
    const amountCents = centsFromInput(form.get('amount'))
    const note = String(form.get('note') || '').trim()
    if (amountCents <= 0) {
      setError('Enter an amount to redeem.')
      return
    }
    if (amountCents > card.balance_cents) {
      setError('The amount is higher than the remaining balance.')
      return
    }
    if (!window.confirm(`Redeem ${money(amountCents)} from ${card.code}?`)) return

    setBusy(true)
    setError('')
    try {
      await post({ action: 'redeem', giftCardId: card.id, amountCents, note })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to redeem gift card.')
    } finally {
      setBusy(false)
    }
  }

  async function voidCard(card: GiftCard) {
    if (!initData || !window.confirm(`Void ${card.code}? The remaining balance will no longer be usable.`)) return
    const note = window.prompt('Optional internal reason:', '') || ''
    setBusy(true)
    setError('')
    try {
      await post({ action: 'void', giftCardId: card.id, note })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to void gift card.')
    } finally {
      setBusy(false)
    }
  }

  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      window.setTimeout(() => setCopied((current) => current === key ? '' : current), 1400)
    } catch {
      setError('Could not copy. Press and hold the text instead.')
    }
  }

  async function shareCard(card: Pick<GiftCard, 'public_token' | 'recipient_name'> | { public_token: string; recipient_name?: string }) {
    const url = `${window.location.origin}/gift/${card.public_token}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'kisu.tatts gift card', text: card.recipient_name ? `Gift card for ${card.recipient_name}` : 'kisu.tatts gift card', url })
        return
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return
      }
    }
    await copyText(url, `share-${card.public_token}`)
  }

  if (!initData && !loading) {
    return (
      <div className="admin-gate">
        <span>♡</span>
        <h1>Gift cards</h1>
        <p>Open this page from the kisu.tatts Telegram admin.</p>
      </div>
    )
  }

  if (loading && !payload) return <div className="admin-loading">Loading gift cards…</div>

  return (
    <div className="booking-admin gift-admin">
      <header className="admin-head">
        <div>
          <div className="section-label">♡ private · telegram verified</div>
          <h1>Gift <span>cards</span></h1>
          <p>Create, share and redeem certificates.</p>
        </div>
        <button type="button" className="admin-refresh" onClick={() => void load()} disabled={busy}>↻ Refresh</button>
      </header>

      {error ? <div className="admin-error" role="alert">{error}</div> : null}

      {createdCard ? (
        <section className="admin-card gift-created-card">
          <div><span>✓ Created</span><strong>{createdCard.code}</strong></div>
          <div className="gift-created-actions">
            <button type="button" onClick={() => void copyText(createdCard.code, createdCard.code)}>{copied === createdCard.code ? 'Copied ✓' : 'Copy code'}</button>
            <a href={`/gift/${createdCard.public_token}`} target="_blank" rel="noreferrer">View card</a>
            <button type="button" onClick={() => void shareCard(createdCard)}>{copied === `share-${createdCard.public_token}` ? 'Link copied ✓' : 'Share'}</button>
            <button type="button" className="gift-dismiss" onClick={() => setCreatedCard(null)}>×</button>
          </div>
        </section>
      ) : null}

      <section className="admin-card gift-create-card">
        <div className="admin-card-title">
          <span>♡</span>
          <div><h2>New gift card</h2><p>Create only after payment has been received.</p></div>
        </div>
        <form className="gift-create-form" onSubmit={(event) => void createCard(event)}>
          <label><span>Value, €</span><input name="amount" type="number" min="1" max="10000" step="0.01" placeholder="150" required disabled={busy} /></label>
          <label><span>Recipient</span><input name="recipientName" type="text" maxLength={100} placeholder="Anna" required disabled={busy} /></label>
          <label><span>From (optional)</span><input name="fromName" type="text" maxLength={100} placeholder="Max" disabled={busy} /></label>
          <label><span>Buyer contact (internal)</span><input name="buyerContact" type="text" maxLength={200} placeholder="@username" disabled={busy} /></label>
          <label className="gift-wide"><span>Message on card (optional)</span><textarea name="message" rows={3} maxLength={1000} placeholder="Happy birthday! ♡" disabled={busy} /></label>
          <label className="gift-wide"><span>Internal note (optional)</span><textarea name="internalNote" rows={2} maxLength={2000} placeholder="Paid in cash after session" disabled={busy} /></label>
          <button className="primary-button gift-create-submit" type="submit" disabled={busy}>{busy ? 'Creating…' : '＋ Create gift card'}</button>
        </form>
      </section>

      <section className="admin-section">
        <div className="admin-section-head"><div><div className="section-label">Certificates</div><h2>Gift cards</h2></div><b>{filteredCards.length}</b></div>
        <div className="gift-filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search code, recipient or buyer…" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="redeemed">Redeemed</option>
            <option value="void">Void</option>
          </select>
        </div>

        <div className="gift-card-list">
          {filteredCards.length === 0 ? <p className="admin-empty">No gift cards found.</p> : filteredCards.map((card) => {
            const transactions = transactionsByCard.get(card.id) || []
            return (
              <details className="gift-admin-card" key={card.id}>
                <summary>
                  <div className="gift-summary-main"><strong>{card.recipient_name}</strong><span>{card.code}</span></div>
                  <div className="gift-summary-money"><strong>{money(card.balance_cents)}</strong><small>of {money(card.initial_amount_cents)}</small></div>
                  <span className={`gift-status gift-status-${card.status}`}>{card.status}</span>
                </summary>
                <div className="gift-card-body">
                  <div className="gift-meta-grid">
                    <div><span>Recipient</span><b>{card.recipient_name}</b></div>
                    <div><span>From</span><b>{card.from_name || '—'}</b></div>
                    <div><span>Buyer contact</span><b>{card.buyer_contact || '—'}</b></div>
                    <div><span>Created</span><b>{dateTime(card.created_at)}</b></div>
                  </div>

                  {card.message ? <div className="gift-note"><span>Message on card</span><p>{card.message}</p></div> : null}
                  {card.internal_note ? <div className="gift-note internal"><span>Internal note</span><p>{card.internal_note}</p></div> : null}

                  <div className="gift-code-tools">
                    <code>{card.code}</code>
                    <button type="button" onClick={() => void copyText(card.code, card.id)}>{copied === card.id ? 'Copied ✓' : 'Copy code'}</button>
                    <a href={`/gift/${card.public_token}`} target="_blank" rel="noreferrer">View card</a>
                    <button type="button" onClick={() => void shareCard(card)}>{copied === `share-${card.public_token}` ? 'Link copied ✓' : 'Share'}</button>
                  </div>

                  {card.status === 'active' ? (
                    <form className="gift-redeem-form" onSubmit={(event) => void redeemCard(event, card)}>
                      <div><b>Redeem balance</b><span>Remaining: {money(card.balance_cents)}</span></div>
                      <label><span>Amount, €</span><input name="amount" type="number" min="0.01" max={(card.balance_cents / 100).toFixed(2)} step="0.01" required disabled={busy} /></label>
                      <label className="gift-redeem-note"><span>Note (optional)</span><input name="note" type="text" maxLength={2000} placeholder="Tattoo session" disabled={busy} /></label>
                      <button type="submit" disabled={busy}>Redeem</button>
                    </form>
                  ) : null}

                  <div className="gift-history">
                    <h3>History</h3>
                    {transactions.length === 0 ? <p>No transactions.</p> : transactions.map((transaction) => (
                      <div className="gift-history-row" key={transaction.id}>
                        <span>{transaction.kind === 'issued' ? '＋' : transaction.kind === 'redeemed' ? '−' : transaction.kind === 'voided' ? '×' : '↕'}</span>
                        <div><b>{transaction.kind}</b><small>{transaction.note || dateTime(transaction.created_at)}</small></div>
                        <strong>{transaction.amount_cents === 0 ? '—' : money(Math.abs(transaction.amount_cents))}</strong>
                      </div>
                    ))}
                  </div>

                  {card.status === 'active' ? <button type="button" className="gift-void" disabled={busy} onClick={() => void voidCard(card)}>Void gift card</button> : null}
                </div>
              </details>
            )
          })}
        </div>
      </section>
    </div>
  )
}
