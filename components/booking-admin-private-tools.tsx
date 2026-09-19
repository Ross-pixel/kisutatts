'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type RequestStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed'

type BookingRequest = {
  id: string
  name: string
  contact: string
  status: RequestStatus
  admin_note: string | null
  scheduled_starts_at: string
  scheduled_ends_at: string
}

type AdminPayload = {
  requests: BookingRequest[]
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string
        ready?: () => void
        expand?: () => void
      }
    }
  }
}

function formatScheduled(request: BookingRequest) {
  const start = new Date(request.scheduled_starts_at)
  const end = new Date(request.scheduled_ends_at)
  const date = new Intl.DateTimeFormat('en-FI', {
    timeZone: 'Europe/Helsinki',
    day: 'numeric',
    month: 'short',
  }).format(start)
  const time = new Intl.DateTimeFormat('en-FI', {
    timeZone: 'Europe/Helsinki',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${date} · ${time.format(start)}–${time.format(end)}`
}

export function BookingAdminPrivateTools() {
  const [initData, setInitData] = useState('')
  const [payload, setPayload] = useState<AdminPayload | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let attempts = 0
    const readTelegram = () => {
      const webApp = window.Telegram?.WebApp
      const data = webApp?.initData || ''
      if (data) {
        webApp?.ready?.()
        webApp?.expand?.()
        setInitData(data)
        return
      }
      attempts += 1
      if (attempts < 30) window.setTimeout(readTelegram, 100)
    }
    readTelegram()
  }, [])

  async function load(data = initData) {
    if (!data) return
    try {
      const response = await fetch('/api/admin/booking', {
        headers: { 'x-telegram-init-data': data },
        cache: 'no-store',
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Unable to load private tools.')
      setPayload(body)
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load private tools.')
    }
  }

  useEffect(() => {
    if (initData) void load(initData)
  }, [initData])

  const active = useMemo(
    () => (payload?.requests || [])
      .filter((request) => request.status === 'pending' || request.status === 'confirmed')
      .sort((a, b) => new Date(a.scheduled_starts_at).getTime() - new Date(b.scheduled_starts_at).getTime()),
    [payload],
  )

  const selected = active.find((request) => request.id === selectedId) || active[0]

  useEffect(() => {
    if (!selected) {
      setSelectedId('')
      setNote('')
      return
    }
    if (selected.id !== selectedId) setSelectedId(selected.id)
    setNote(selected.admin_note || '')
  }, [selected?.id, selected?.admin_note])

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!initData || !selected) return
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/booking/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData,
        },
        body: JSON.stringify({
          requestId: selected.id,
          action: 'note',
          note,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Unable to save note.')
      setMessage('Private note saved ✓')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save note.')
    } finally {
      setBusy(false)
    }
  }

  async function markCompleted() {
    if (!initData || !selected || selected.status !== 'confirmed') return
    if (!window.confirm(`Mark ${selected.name}'s appointment as completed? This keeps the calendar time as historical booked time.`)) return

    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/booking/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData,
        },
        body: JSON.stringify({ requestId: selected.id, action: 'complete' }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Unable to complete booking.')
      setMessage('Appointment marked completed ✓')
      setSelectedId('')
      await load()
      window.setTimeout(() => window.location.reload(), 450)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to complete booking.')
    } finally {
      setBusy(false)
    }
  }

  if (!initData || !payload) return null

  return (
    <section className="admin-card admin-private-tools">
      <div className="admin-private-head">
        <div>
          <div className="section-label">✧ Internal only</div>
          <h2>Private notes</h2>
          <p>Notes in this section are never shown to the client.</p>
        </div>
        <span>{active.length} active</span>
      </div>

      {active.length === 0 ? (
        <p className="admin-empty">No pending or confirmed appointments need private notes.</p>
      ) : (
        <>
          <label className="admin-private-select">
            <span>Client</span>
            <select
              value={selected?.id || ''}
              disabled={busy}
              onChange={(event) => {
                setSelectedId(event.target.value)
                setMessage('')
              }}
            >
              {active.map((request) => (
                <option value={request.id} key={request.id}>
                  {request.name} · {request.contact} · {request.status}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <form className="admin-private-form" onSubmit={saveNote}>
              <div className="admin-private-client">
                <div><b>{selected.name}</b><span>{selected.contact}</span></div>
                <small>{formatScheduled(selected)}</small>
              </div>
              <label>
                <span>Admin note</span>
                <textarea
                  value={note}
                  maxLength={2000}
                  rows={4}
                  placeholder="e.g. deposit paid, placement confirmed, bring stencil…"
                  disabled={busy}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <div className="admin-private-actions">
                <button type="submit" className="admin-private-save" disabled={busy}>{busy ? 'Saving…' : 'Save note'}</button>
                {selected.status === 'confirmed' ? (
                  <button type="button" className="admin-complete-booking" disabled={busy} onClick={() => void markCompleted()}>✓ Mark completed</button>
                ) : null}
              </div>
            </form>
          ) : null}
        </>
      )}

      {message ? <p className="admin-private-message" role="status">{message}</p> : null}
    </section>
  )
}
