'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type SlotStatus = 'available' | 'pending' | 'booked' | 'blocked'
type RequestStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled'

type BookingSlot = {
  id: string
  starts_at: string
  ends_at: string
  status: SlotStatus
  note: string | null
}

type BookingRequest = {
  id: string
  slot_id: string
  name: string
  contact: string
  idea: string
  budget: string | null
  status: RequestStatus
  created_at: string
  attachmentCount: number
}

type AdminPayload = {
  admin: { id: number; firstName: string; username: string }
  slots: BookingSlot[]
  requests: BookingRequest[]
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string
        ready?: () => void
        expand?: () => void
        setHeaderColor?: (color: string) => void
        setBackgroundColor?: (color: string) => void
      }
    }
  }
}

function formatSlot(slot: BookingSlot) {
  const date = new Intl.DateTimeFormat('en-FI', {
    timeZone: 'Europe/Helsinki',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(slot.starts_at))
  const time = new Intl.DateTimeFormat('en-FI', {
    timeZone: 'Europe/Helsinki',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${date} · ${time.format(new Date(slot.starts_at))}–${time.format(new Date(slot.ends_at))}`
}

function todayHelsinki() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function BookingAdmin() {
  const [initData, setInitData] = useState('')
  const [payload, setPayload] = useState<AdminPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let attempts = 0
    const readTelegram = () => {
      const webApp = window.Telegram?.WebApp
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
      const response = await fetch('/api/admin/booking', {
        headers: { 'x-telegram-init-data': data },
        cache: 'no-store',
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Unable to load admin.')
      setPayload(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initData) void load(initData)
  }, [initData])

  const slotsById = useMemo(() => new Map((payload?.slots || []).map((slot) => [slot.id, slot])), [payload])
  const futureSlots = useMemo(
    () => (payload?.slots || []).filter((slot) => new Date(slot.ends_at).getTime() > Date.now()),
    [payload],
  )
  const activeRequests = useMemo(
    () => (payload?.requests || []).filter((request) => request.status === 'pending' || request.status === 'confirmed'),
    [payload],
  )

  async function createSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!initData) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData(event.currentTarget)
      const response = await fetch('/api/admin/booking/slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData,
        },
        body: JSON.stringify({
          date: form.get('date'),
          startTime: form.get('startTime'),
          endTime: form.get('endTime'),
          note: form.get('note'),
          status: form.get('status'),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Unable to create slot.')
      event.currentTarget.reset()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create slot.')
    } finally {
      setBusy(false)
    }
  }

  async function changeSlot(slot: BookingSlot, status: 'available' | 'blocked') {
    if (!initData) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/booking/slots', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData,
        },
        body: JSON.stringify({ id: slot.id, status }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Unable to update slot.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update slot.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteSlot(slot: BookingSlot) {
    if (!initData || !window.confirm('Delete this unused slot?')) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/booking/slots?id=${encodeURIComponent(slot.id)}`, {
        method: 'DELETE',
        headers: { 'x-telegram-init-data': initData },
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Unable to delete slot.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete slot.')
    } finally {
      setBusy(false)
    }
  }

  if (!initData && !loading) {
    return (
      <div className="admin-gate">
        <span>♡</span>
        <h1>Booking admin</h1>
        <p>Open this page from the <b>♡ Booking admin</b> button in the kisu.tatts Telegram bot.</p>
      </div>
    )
  }

  if (loading && !payload) {
    return <div className="admin-loading">Loading booking admin…</div>
  }

  return (
    <div className="booking-admin">
      <header className="admin-head">
        <div>
          <div className="section-label">♡ private · telegram verified</div>
          <h1>Booking <span>admin</span></h1>
          <p>{payload?.admin.firstName ? `Hi, ${payload.admin.firstName} ♡` : 'kisu.tatts booking dashboard'}</p>
        </div>
        <button type="button" className="admin-refresh" onClick={() => void load()} disabled={busy}>↻ Refresh</button>
      </header>

      {error ? <div className="admin-error" role="alert">{error}</div> : null}

      <section className="admin-card admin-create">
        <div className="admin-card-title">
          <span>✦</span>
          <div><h2>Add a slot</h2><p>Times are always saved and shown in Europe/Helsinki.</p></div>
        </div>
        <form className="admin-slot-form" onSubmit={createSlot}>
          <label><span>Date</span><input name="date" type="date" min={todayHelsinki()} required disabled={busy} /></label>
          <label><span>Start</span><input name="startTime" type="time" required disabled={busy} /></label>
          <label><span>End</span><input name="endTime" type="time" required disabled={busy} /></label>
          <label><span>Type</span><select name="status" defaultValue="available" disabled={busy}><option value="available">Available</option><option value="blocked">Blocked</option></select></label>
          <label className="admin-note"><span>Note (optional)</span><input name="note" type="text" maxLength={300} placeholder="e.g. flash day" disabled={busy} /></label>
          <button className="primary-button admin-add" type="submit" disabled={busy}>{busy ? 'Saving…' : '＋ Add slot'}</button>
        </form>
      </section>

      <section className="admin-section">
        <div className="admin-section-head"><div><div className="section-label">Upcoming</div><h2>Slots</h2></div><b>{futureSlots.length}</b></div>
        <div className="admin-slot-list">
          {futureSlots.length === 0 ? <p className="admin-empty">No upcoming slots yet.</p> : futureSlots.map((slot) => (
            <article className={`admin-slot admin-status-${slot.status}`} key={slot.id}>
              <div className="admin-slot-main"><strong>{formatSlot(slot)}</strong><span>{slot.note || 'Tampere'}</span></div>
              <span className="admin-status">{slot.status}</span>
              {(slot.status === 'available' || slot.status === 'blocked') ? (
                <div className="admin-slot-actions">
                  <button type="button" disabled={busy} onClick={() => void changeSlot(slot, slot.status === 'available' ? 'blocked' : 'available')}>{slot.status === 'available' ? 'Block' : 'Open'}</button>
                  <button type="button" disabled={busy} onClick={() => void deleteSlot(slot)}>Delete</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-head"><div><div className="section-label">Clients</div><h2>Requests</h2></div><b>{activeRequests.length}</b></div>
        <div className="admin-request-list">
          {activeRequests.length === 0 ? <p className="admin-empty">No active requests.</p> : activeRequests.map((request) => {
            const slot = slotsById.get(request.slot_id)
            return (
              <article className="admin-request" key={request.id}>
                <div className="admin-request-top">
                  <div><strong>{request.name}</strong><span>{request.contact}</span></div>
                  <span className={`admin-status admin-status-${request.status}`}>{request.status}</span>
                </div>
                <div className="admin-request-date">{slot ? formatSlot(slot) : 'Slot unavailable'}</div>
                <p>{request.idea}</p>
                <footer><span>Budget: <b>{request.budget || '—'}</b></span><span>References: <b>{request.attachmentCount}</b></span></footer>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
