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

type BookingAttachment = {
  id: string
  originalFilename: string
  mimeType: string
  fileSize: number | null
  signedUrl: string
}

type BookingRequest = {
  id: string
  slot_id: string | null
  name: string
  contact: string
  idea: string
  budget: string | null
  status: RequestStatus
  requested_starts_at: string
  requested_ends_at: string
  scheduled_starts_at: string
  scheduled_ends_at: string
  created_at: string
  attachments: BookingAttachment[]
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

const HELSINKI = 'Europe/Helsinki'
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function helsinkiDateParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HELSINKI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(typeof value === 'string' ? new Date(value) : value)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return { year: get('year'), month: get('month'), day: get('day') }
}

function dateKeyFromIso(iso: string) {
  const { year, month, day } = helsinkiDateParts(iso)
  return `${year}-${month}-${day}`
}

function todayHelsinki() {
  const { year, month, day } = helsinkiDateParts(new Date())
  return `${year}-${month}-${day}`
}

function timeFromIso(iso: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: HELSINKI,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${get('hour')}:${get('minute')}`
}

function formatCalendarDate(dateKey: string, withYear = false) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  return new Intl.DateTimeFormat('en-FI', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' as const } : {}),
  }).format(date)
}

function formatMonth(monthKey: string) {
  const date = new Date(`${monthKey}T12:00:00Z`)
  return new Intl.DateTimeFormat('en-FI', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatSlot(slot: BookingSlot) {
  const date = new Intl.DateTimeFormat('en-FI', {
    timeZone: HELSINKI,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(slot.starts_at))
  return `${date} · ${timeFromIso(slot.starts_at)}–${timeFromIso(slot.ends_at)}`
}

function formatRange(startsAt: string, endsAt: string) {
  const date = new Intl.DateTimeFormat('en-FI', {
    timeZone: HELSINKI,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(startsAt))
  return `${date} · ${timeFromIso(startsAt)}–${timeFromIso(endsAt)}`
}

function durationLabel(startsAt: string, endsAt: string) {
  const minutes = Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}m`
  if (!rest) return `${hours}h`
  return `${hours}h ${rest}m`
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function monthKeyFromDate(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`
}

function addMonths(monthKey: string, amount: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + amount, 1, 12))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function calendarCells(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1, 12))
  const days = new Date(Date.UTC(year, month, 0, 12)).getUTCDate()
  const offset = (first.getUTCDay() + 6) % 7
  const values: Array<string | null> = Array(offset).fill(null)
  for (let day = 1; day <= days; day += 1) {
    values.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  while (values.length % 7 !== 0) values.push(null)
  return values
}

function schedulesDiffer(request: BookingRequest) {
  return new Date(request.requested_starts_at).getTime() !== new Date(request.scheduled_starts_at).getTime()
    || new Date(request.requested_ends_at).getTime() !== new Date(request.scheduled_ends_at).getTime()
}

export function BookingAdmin() {
  const initialDate = todayHelsinki()
  const [initData, setInitData] = useState('')
  const [payload, setPayload] = useState<AdminPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [monthKey, setMonthKey] = useState(monthKeyFromDate(initialDate))
  const [showAddSlot, setShowAddSlot] = useState(false)
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)

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
  const activeRequests = useMemo(
    () => (payload?.requests || [])
      .filter((request) => request.status === 'pending' || request.status === 'confirmed')
      .sort((a, b) => new Date(a.scheduled_starts_at).getTime() - new Date(b.scheduled_starts_at).getTime()),
    [payload],
  )
  const requestsBySlotId = useMemo(() => {
    const map = new Map<string, BookingRequest>()
    for (const request of activeRequests) {
      if (request.slot_id) map.set(request.slot_id, request)
    }
    return map
  }, [activeRequests])
  const slotsByDate = useMemo(() => {
    const map = new Map<string, BookingSlot[]>()
    for (const slot of payload?.slots || []) {
      const key = dateKeyFromIso(slot.starts_at)
      const list = map.get(key) || []
      list.push(slot)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    }
    return map
  }, [payload])
  const selectedDaySlots = slotsByDate.get(selectedDate) || []
  const cells = useMemo(() => calendarCells(monthKey), [monthKey])
  const monthPrefix = monthKey.slice(0, 7)
  const monthSlots = useMemo(
    () => (payload?.slots || []).filter((slot) => dateKeyFromIso(slot.starts_at).startsWith(monthPrefix)),
    [payload, monthPrefix],
  )
  const monthCounts = useMemo(() => ({
    available: monthSlots.filter((slot) => slot.status === 'available').length,
    pending: monthSlots.filter((slot) => slot.status === 'pending').length,
    booked: monthSlots.filter((slot) => slot.status === 'booked').length,
    blocked: monthSlots.filter((slot) => slot.status === 'blocked').length,
  }), [monthSlots])

  function selectCalendarDate(dateKey: string) {
    setSelectedDate(dateKey)
    setShowAddSlot(false)
    setEditingSlotId(null)
  }

  function navigateMonth(amount: number) {
    const next = addMonths(monthKey, amount)
    setMonthKey(next)
    setSelectedDate(next)
    setShowAddSlot(false)
    setEditingSlotId(null)
  }

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
          date: selectedDate,
          startTime: form.get('startTime'),
          endTime: form.get('endTime'),
          note: form.get('note'),
          status: form.get('status'),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Unable to create slot.')
      event.currentTarget.reset()
      setShowAddSlot(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create slot.')
    } finally {
      setBusy(false)
    }
  }

  async function editSlot(event: FormEvent<HTMLFormElement>, slot: BookingSlot) {
    event.preventDefault()
    if (!initData) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData(event.currentTarget)
      const date = String(form.get('date') || '')
      const response = await fetch('/api/admin/booking/slots', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData,
        },
        body: JSON.stringify({
          id: slot.id,
          date,
          startTime: form.get('startTime'),
          endTime: form.get('endTime'),
          note: form.get('note'),
          status: form.get('status'),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Unable to update slot.')
      setEditingSlotId(null)
      if (date) {
        setSelectedDate(date)
        setMonthKey(monthKeyFromDate(date))
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update slot.')
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

  async function runRequestAction(bookingRequest: BookingRequest, action: 'confirm' | 'reject') {
    if (!initData) return
    if (action === 'reject' && !window.confirm(`Decline ${bookingRequest.name}'s request and release the slot?`)) return

    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/booking/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData,
        },
        body: JSON.stringify({ requestId: bookingRequest.id, action }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Unable to update booking request.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update booking request.')
    } finally {
      setBusy(false)
    }
  }

  async function adjustRequest(event: FormEvent<HTMLFormElement>, bookingRequest: BookingRequest) {
    event.preventDefault()
    if (!initData) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData(event.currentTarget)
      const date = String(form.get('date') || '')
      const response = await fetch('/api/admin/booking/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData,
        },
        body: JSON.stringify({
          requestId: bookingRequest.id,
          action: 'adjust',
          date,
          startTime: form.get('startTime'),
          endTime: form.get('endTime'),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Unable to adjust booking time.')
      setEditingRequestId(null)
      if (date) {
        setSelectedDate(date)
        setMonthKey(monthKeyFromDate(date))
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to adjust booking time.')
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

      <section className="admin-card admin-calendar-card">
        <div className="admin-calendar-head">
          <button type="button" className="admin-calendar-nav" onClick={() => navigateMonth(-1)} aria-label="Previous month">‹</button>
          <div>
            <div className="section-label">Calendar</div>
            <h2>{formatMonth(monthKey)}</h2>
          </div>
          <button type="button" className="admin-calendar-nav" onClick={() => navigateMonth(1)} aria-label="Next month">›</button>
        </div>

        <div className="admin-calendar-summary">
          <span className="summary-available"><i />Available <b>{monthCounts.available}</b></span>
          <span className="summary-pending"><i />Pending <b>{monthCounts.pending}</b></span>
          <span className="summary-booked"><i />Booked <b>{monthCounts.booked}</b></span>
          <span className="summary-blocked"><i />Blocked <b>{monthCounts.blocked}</b></span>
        </div>

        <div className="admin-calendar-weekdays">
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="admin-calendar-grid">
          {cells.map((dateKey, index) => {
            if (!dateKey) return <div className="admin-calendar-empty-cell" key={`empty-${index}`} />
            const daySlots = slotsByDate.get(dateKey) || []
            const selected = dateKey === selectedDate
            const today = dateKey === initialDate
            return (
              <button
                type="button"
                className={`admin-calendar-day${selected ? ' selected' : ''}${today ? ' today' : ''}`}
                key={dateKey}
                onClick={() => selectCalendarDate(dateKey)}
                aria-pressed={selected}
                aria-label={`${formatCalendarDate(dateKey, true)}, ${daySlots.length} slots`}
              >
                <strong>{Number(dateKey.slice(-2))}</strong>
                <span className="admin-calendar-dots" aria-hidden="true">
                  {daySlots.slice(0, 3).map((slot) => <i className={`dot-${slot.status}`} key={slot.id} />)}
                  {daySlots.length > 3 ? <small>+{daySlots.length - 3}</small> : null}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="admin-card admin-day-panel">
        <div className="admin-day-head">
          <div>
            <div className="section-label">Selected day</div>
            <h2>{formatCalendarDate(selectedDate, true)}</h2>
          </div>
          <button
            type="button"
            className="admin-day-add"
            disabled={selectedDate < initialDate || busy}
            onClick={() => {
              setShowAddSlot((current) => !current)
              setEditingSlotId(null)
            }}
          >＋ Add slot</button>
        </div>

        {selectedDate < initialDate ? <p className="admin-day-hint">Past dates are view-only.</p> : null}

        {showAddSlot ? (
          <form className="admin-inline-form admin-add-slot-form" onSubmit={createSlot}>
            <div className="admin-inline-form-title"><b>New window</b><span>{selectedDate}</span></div>
            <label><span>Start</span><input name="startTime" type="time" defaultValue="12:00" required disabled={busy} /></label>
            <label><span>End</span><input name="endTime" type="time" defaultValue="15:00" required disabled={busy} /></label>
            <label><span>Type</span><select name="status" defaultValue="available" disabled={busy}><option value="available">Available</option><option value="blocked">Blocked</option></select></label>
            <label className="admin-inline-note"><span>Note</span><input name="note" type="text" maxLength={300} placeholder="e.g. flash day" disabled={busy} /></label>
            <div className="admin-inline-actions"><button type="button" onClick={() => setShowAddSlot(false)} disabled={busy}>Cancel</button><button className="admin-save" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save slot'}</button></div>
          </form>
        ) : null}

        <div className="admin-day-slots">
          {selectedDaySlots.length === 0 ? <p className="admin-empty">Nothing scheduled for this day.</p> : selectedDaySlots.map((slot) => {
            const bookingRequest = requestsBySlotId.get(slot.id)
            const editable = slot.status === 'available' || slot.status === 'blocked'
            return (
              <article className={`admin-day-slot admin-status-${slot.status}`} key={slot.id}>
                {editingSlotId === slot.id && editable ? (
                  <form className="admin-inline-form admin-edit-slot-form" onSubmit={(event) => void editSlot(event, slot)}>
                    <div className="admin-inline-form-title"><b>Edit slot</b><span>{durationLabel(slot.starts_at, slot.ends_at)}</span></div>
                    <label><span>Date</span><input name="date" type="date" min={initialDate} defaultValue={dateKeyFromIso(slot.starts_at)} required disabled={busy} /></label>
                    <label><span>Start</span><input name="startTime" type="time" defaultValue={timeFromIso(slot.starts_at)} required disabled={busy} /></label>
                    <label><span>End</span><input name="endTime" type="time" defaultValue={timeFromIso(slot.ends_at)} required disabled={busy} /></label>
                    <label><span>Type</span><select name="status" defaultValue={slot.status} disabled={busy}><option value="available">Available</option><option value="blocked">Blocked</option></select></label>
                    <label className="admin-inline-note"><span>Note</span><input name="note" type="text" maxLength={300} defaultValue={slot.note || ''} disabled={busy} /></label>
                    <div className="admin-inline-actions"><button type="button" onClick={() => setEditingSlotId(null)} disabled={busy}>Cancel</button><button className="admin-save" type="submit" disabled={busy}>Save changes</button></div>
                  </form>
                ) : (
                  <>
                    <div className="admin-day-slot-main">
                      <strong>{timeFromIso(slot.starts_at)}–{timeFromIso(slot.ends_at)} <em>· {durationLabel(slot.starts_at, slot.ends_at)}</em></strong>
                      <span>{bookingRequest ? `${bookingRequest.name} · ${bookingRequest.contact}` : slot.note || 'Tampere'}</span>
                    </div>
                    <span className="admin-status">{slot.status}</span>
                    {editable ? (
                      <div className="admin-slot-actions">
                        <button type="button" disabled={busy} onClick={() => { setEditingSlotId(slot.id); setShowAddSlot(false) }}>Edit</button>
                        <button type="button" disabled={busy} onClick={() => void changeSlot(slot, slot.status === 'available' ? 'blocked' : 'available')}>{slot.status === 'available' ? 'Block' : 'Open'}</button>
                        <button type="button" disabled={busy} onClick={() => void deleteSlot(slot)}>Delete</button>
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-head"><div><div className="section-label">Clients</div><h2>Requests</h2></div><b>{activeRequests.length}</b></div>
        <div className="admin-request-list">
          {activeRequests.length === 0 ? <p className="admin-empty">No active requests.</p> : activeRequests.map((bookingRequest) => {
            const slot = bookingRequest.slot_id ? slotsById.get(bookingRequest.slot_id) : undefined
            const adjusted = schedulesDiffer(bookingRequest)
            return (
              <article className="admin-request" key={bookingRequest.id}>
                <div className="admin-request-top">
                  <div><strong>{bookingRequest.name}</strong><span>{bookingRequest.contact}</span></div>
                  <span className={`admin-status admin-status-${bookingRequest.status}`}>{bookingRequest.status}</span>
                </div>

                <div className="admin-request-times">
                  <div><span>Requested</span><b>{formatRange(bookingRequest.requested_starts_at, bookingRequest.requested_ends_at)}</b><small>{durationLabel(bookingRequest.requested_starts_at, bookingRequest.requested_ends_at)}</small></div>
                  <div className={adjusted ? 'adjusted' : ''}><span>Scheduled</span><b>{formatRange(bookingRequest.scheduled_starts_at, bookingRequest.scheduled_ends_at)}</b><small>{adjusted ? `Adjusted · ${durationLabel(bookingRequest.scheduled_starts_at, bookingRequest.scheduled_ends_at)}` : `Same as requested · ${durationLabel(bookingRequest.scheduled_starts_at, bookingRequest.scheduled_ends_at)}`}</small></div>
                </div>

                {slot ? <button className="admin-jump-date" type="button" onClick={() => { const date = dateKeyFromIso(slot.starts_at); setSelectedDate(date); setMonthKey(monthKeyFromDate(date)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>View in calendar ↑</button> : null}

                <p>{bookingRequest.idea}</p>
                <footer><span>Budget: <b>{bookingRequest.budget || '—'}</b></span><span>References: <b>{bookingRequest.attachments.length}</b></span></footer>

                {bookingRequest.attachments.length > 0 ? (
                  <div className="admin-reference-grid">
                    {bookingRequest.attachments.map((attachment) => {
                      const previewable = ['image/jpeg', 'image/png', 'image/webp'].includes(attachment.mimeType)
                      return previewable ? (
                        <a className="admin-reference admin-reference-image" href={attachment.signedUrl} target="_blank" rel="noreferrer" key={attachment.id}>
                          <img src={attachment.signedUrl} alt={attachment.originalFilename} />
                          <span>{attachment.originalFilename}</span>
                        </a>
                      ) : (
                        <a className="admin-reference admin-reference-file" href={attachment.signedUrl} target="_blank" rel="noreferrer" key={attachment.id}>
                          <b>▧ {attachment.originalFilename}</b>
                          <small>{attachment.mimeType.replace('image/', '').toUpperCase()} {formatFileSize(attachment.fileSize)}</small>
                        </a>
                      )
                    })}
                  </div>
                ) : null}

                {editingRequestId === bookingRequest.id ? (
                  <form className="admin-inline-form admin-adjust-form" onSubmit={(event) => void adjustRequest(event, bookingRequest)}>
                    <div className="admin-inline-form-title"><b>Adjust scheduled time</b><span>Client choice stays saved above.</span></div>
                    <label><span>Date</span><input name="date" type="date" min={initialDate} defaultValue={dateKeyFromIso(bookingRequest.scheduled_starts_at)} required disabled={busy} /></label>
                    <label><span>Start</span><input name="startTime" type="time" defaultValue={timeFromIso(bookingRequest.scheduled_starts_at)} required disabled={busy} /></label>
                    <label><span>End</span><input name="endTime" type="time" defaultValue={timeFromIso(bookingRequest.scheduled_ends_at)} required disabled={busy} /></label>
                    <p className="admin-adjust-hint">Available windows are consumed/split automatically. Booked, pending and blocked time cannot be overwritten.</p>
                    <div className="admin-inline-actions"><button type="button" disabled={busy} onClick={() => setEditingRequestId(null)}>Cancel</button><button className="admin-save" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save new time'}</button></div>
                  </form>
                ) : null}

                <div className="admin-request-actions">
                  {bookingRequest.status === 'pending' ? <button className="admin-confirm" type="button" disabled={busy} onClick={() => void runRequestAction(bookingRequest, 'confirm')}>✓ Confirm</button> : null}
                  <button className="admin-adjust" type="button" disabled={busy} onClick={() => setEditingRequestId((current) => current === bookingRequest.id ? null : bookingRequest.id)}>↔ Adjust time</button>
                  {bookingRequest.status === 'pending' ? <button className="admin-decline" type="button" disabled={busy} onClick={() => void runRequestAction(bookingRequest, 'reject')}>✕ Decline</button> : null}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
