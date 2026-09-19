'use client'

import Script from 'next/script'
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/components/language-provider'
import {
  MAX_REFERENCE_FILE_SIZE,
  MAX_REFERENCE_FILES,
  ReferenceMime,
  normalizeReferenceMime,
} from '@/lib/booking-references'

type BookingSlot = {
  id: string
  starts_at: string
  ends_at: string
}

type ReferenceFile = {
  file: File
  mimeType: ReferenceMime
  key: string
}

type SignedUpload = {
  attachmentId: string
  storagePath: string
  signedUrl: string
  mimeType: ReferenceMime
}

type SubmitState =
  | { type: 'idle' }
  | { type: 'loading'; stage: 'booking' | 'references'; current?: number; total?: number }
  | { type: 'success'; requestId: string; slotLabel: string; referenceWarning?: boolean }
  | { type: 'error'; message: string }

declare global {
  interface Window {
    turnstile?: {
      reset?: () => void
    }
  }
}

const HELSINKI = 'Europe/Helsinki'

const copy = {
  en: {
    choose: 'Choose a time',
    loading: 'Loading available times…',
    none: 'No available times right now. Check back soon or message Eva on Instagram.',
    selectDay: 'Choose a day with available times.',
    availableOn: 'Available times',
    name: 'Name',
    contact: 'Instagram / Telegram / other contact',
    idea: 'Idea or existing sketch number',
    budget: 'Budget (optional)',
    references: 'Reference photos',
    referencesNote: 'Up to 5 images · JPEG, PNG, WebP, HEIC or HEIF · max 10 MB each. Photos are stored privately.',
    chooseReferences: 'Choose photos',
    remove: 'Remove',
    fileType: 'Reference photos must be JPEG, PNG, WebP, HEIC or HEIF.',
    fileSize: 'Each reference photo must be 10 MB or smaller.',
    fileCount: 'You can attach up to 5 reference photos.',
    privacyBefore: 'I have read the',
    privacyLink: 'booking privacy notice',
    privacyAfter: 'and agree to the use of my booking details to handle this request.',
    send: 'Send booking request',
    sending: 'Sending…',
    uploading: 'Uploading references',
    successTitle: 'Request sent ♡',
    successText: 'Eva will review the idea before confirming the appointment. This slot is now held for your request.',
    successReferences: 'Your reference photos were attached securely.',
    referenceWarning: 'Your booking request was saved, but one or more reference photos could not be attached. Please send those images to Eva separately on Instagram.',
    pickSlot: 'Please choose a time first.',
  },
  fi: {
    choose: 'Valitse aika',
    loading: 'Ladataan vapaita aikoja…',
    none: 'Vapaita aikoja ei ole juuri nyt. Tarkista myöhemmin tai laita Evalle viesti Instagramissa.',
    selectDay: 'Valitse päivä, jolloin on vapaita aikoja.',
    availableOn: 'Vapaat ajat',
    name: 'Nimi',
    contact: 'Instagram / Telegram / muu yhteystieto',
    idea: 'Idea tai valmiin luonnoksen numero',
    budget: 'Budjetti (valinnainen)',
    references: 'Referenssikuvat',
    referencesNote: 'Enintään 5 kuvaa · JPEG, PNG, WebP, HEIC tai HEIF · enintään 10 Mt / kuva. Kuvat tallennetaan yksityisesti.',
    chooseReferences: 'Valitse kuvat',
    remove: 'Poista',
    fileType: 'Referenssikuvien pitää olla JPEG-, PNG-, WebP-, HEIC- tai HEIF-muodossa.',
    fileSize: 'Yksi referenssikuva saa olla enintään 10 Mt.',
    fileCount: 'Voit liittää enintään 5 referenssikuvaa.',
    privacyBefore: 'Olen lukenut',
    privacyLink: 'varauksen tietosuojailmoituksen',
    privacyAfter: 'ja hyväksyn varaustietojeni käytön tämän pyynnön käsittelyyn.',
    send: 'Lähetä varauspyyntö',
    sending: 'Lähetetään…',
    uploading: 'Ladataan referenssejä',
    successTitle: 'Pyyntö lähetetty ♡',
    successText: 'Eva tarkistaa idean ennen ajan vahvistamista. Tämä aika on nyt varattu pyynnöllesi.',
    successReferences: 'Referenssikuvasi liitettiin turvallisesti.',
    referenceWarning: 'Varauspyyntö tallennettiin, mutta yhtä tai useampaa referenssikuvaa ei voitu liittää. Lähetä puuttuvat kuvat Evalle erikseen Instagramissa.',
    pickSlot: 'Valitse ensin aika.',
  },
} as const

function localeFor(language: 'en' | 'fi') {
  return language === 'fi' ? 'fi-FI' : 'en-FI'
}

function dateKeyFromIso(iso: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HELSINKI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function todayHelsinki() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HELSINKI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
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

function formatMonth(monthKey: string, language: 'en' | 'fi') {
  return new Intl.DateTimeFormat(localeFor(language), {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${monthKey}T12:00:00Z`))
}

function formatCalendarDate(dateKey: string, language: 'en' | 'fi') {
  return new Intl.DateTimeFormat(localeFor(language), {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${dateKey}T12:00:00Z`))
}

function formatSlot(slot: BookingSlot, language: 'en' | 'fi') {
  const locale = localeFor(language)
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: HELSINKI,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(slot.starts_at))

  const time = new Intl.DateTimeFormat(locale, {
    timeZone: HELSINKI,
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${day} · ${time.format(new Date(slot.starts_at))}–${time.format(new Date(slot.ends_at))}`
}

function formatSlotTime(slot: BookingSlot, language: 'en' | 'fi') {
  const time = new Intl.DateTimeFormat(localeFor(language), {
    timeZone: HELSINKI,
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${time.format(new Date(slot.starts_at))}–${time.format(new Date(slot.ends_at))}`
}

function durationLabel(slot: BookingSlot) {
  const minutes = Math.max(0, Math.round((new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime()) / 60000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} min`
  if (!rest) return `${hours} h`
  return `${hours} h ${rest} min`
}

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`
}

function ensureUploadMime(reference: ReferenceFile) {
  if (reference.file.type === reference.mimeType) return reference.file

  return new File([reference.file], reference.file.name, {
    type: reference.mimeType,
    lastModified: reference.file.lastModified,
  })
}

export function BookingForm() {
  const { language } = useLanguage()
  const t = copy[language]
  const today = todayHelsinki()
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ''
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [slotsError, setSlotsError] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [monthKey, setMonthKey] = useState(monthKeyFromDate(today))
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([])
  const [referenceError, setReferenceError] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>({ type: 'idle' })

  useEffect(() => {
    let active = true

    fetch('/api/booking/slots', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load slots')
        return response.json() as Promise<BookingSlot[]>
      })
      .then((data) => {
        if (!active) return
        const normalized = Array.isArray(data)
          ? [...data].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
          : []
        setSlots(normalized)
        setSlotsError(false)

        if (normalized.length > 0) {
          const firstDate = dateKeyFromIso(normalized[0].starts_at)
          setSelectedDate(firstDate)
          setMonthKey(monthKeyFromDate(firstDate))
        }
      })
      .catch(() => {
        if (!active) return
        setSlotsError(true)
      })
      .finally(() => {
        if (active) setSlotsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.id === selectedSlotId),
    [slots, selectedSlotId],
  )

  const slotsByDate = useMemo(() => {
    const map = new Map<string, BookingSlot[]>()
    for (const slot of slots) {
      const key = dateKeyFromIso(slot.starts_at)
      const current = map.get(key) || []
      current.push(slot)
      map.set(key, current)
    }
    return map
  }, [slots])

  const selectedDaySlots = selectedDate ? slotsByDate.get(selectedDate) || [] : []
  const cells = useMemo(() => calendarCells(monthKey), [monthKey])
  const weekdays = language === 'fi' ? ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const currentMonthKey = monthKeyFromDate(today)

  function chooseDate(dateKey: string) {
    setSelectedDate(dateKey)
    setSelectedSlotId('')
    if (submitState.type === 'error') setSubmitState({ type: 'idle' })
  }

  function navigateMonth(amount: number) {
    const next = addMonths(monthKey, amount)
    if (next < currentMonthKey) return
    setMonthKey(next)
    setSelectedSlotId('')
    const firstInMonth = slots.find((slot) => dateKeyFromIso(slot.starts_at).startsWith(next.slice(0, 7)))
    setSelectedDate(firstInMonth ? dateKeyFromIso(firstInMonth.starts_at) : '')
  }

  function onReferenceChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (selected.length > MAX_REFERENCE_FILES) {
      setReferenceError(t.fileCount)
      return
    }

    const normalized: ReferenceFile[] = []

    for (const file of selected) {
      const mimeType = normalizeReferenceMime(file.name, file.type)

      if (!mimeType) {
        setReferenceError(t.fileType)
        return
      }

      if (file.size <= 0 || file.size > MAX_REFERENCE_FILE_SIZE) {
        setReferenceError(t.fileSize)
        return
      }

      normalized.push({
        file,
        mimeType,
        key: `${file.name}-${file.size}-${file.lastModified}`,
      })
    }

    setReferenceFiles(normalized)
    setReferenceError('')
  }

  async function uploadReferences(requestId: string) {
    if (referenceFiles.length === 0) return

    const signResponse = await fetch('/api/booking/references/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        files: referenceFiles.map((reference) => ({
          name: reference.file.name,
          type: reference.mimeType,
          size: reference.file.size,
        })),
      }),
    })

    const signData = await signResponse.json()

    if (!signResponse.ok || !Array.isArray(signData?.uploads)) {
      throw new Error(signData?.error || 'Unable to prepare reference uploads.')
    }

    const uploads = signData.uploads as SignedUpload[]
    if (uploads.length !== referenceFiles.length) {
      throw new Error('Unable to prepare all reference uploads.')
    }

    for (let index = 0; index < uploads.length; index += 1) {
      const upload = uploads[index]
      const reference = referenceFiles[index]
      const file = ensureUploadMime(reference)

      setSubmitState({
        type: 'loading',
        stage: 'references',
        current: index + 1,
        total: uploads.length,
      })

      const uploadBody = new FormData()
      uploadBody.append('cacheControl', '3600')
      uploadBody.append('', file)

      const uploadResponse = await fetch(upload.signedUrl, {
        method: 'PUT',
        headers: { 'x-upsert': 'false' },
        body: uploadBody,
      })

      if (!uploadResponse.ok) {
        const detail = await uploadResponse.text()
        console.error('Reference upload failed:', uploadResponse.status, detail)
        throw new Error('Unable to upload one of the reference photos.')
      }

      const completeResponse = await fetch('/api/booking/references/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          attachmentId: upload.attachmentId,
          storagePath: upload.storagePath,
        }),
      })

      if (!completeResponse.ok) {
        const detail = await completeResponse.text()
        console.error('Reference completion failed:', completeResponse.status, detail)
        throw new Error('Unable to finish one of the reference uploads.')
      }
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedSlotId) {
      setSubmitState({ type: 'error', message: t.pickSlot })
      return
    }

    if (referenceError) {
      setSubmitState({ type: 'error', message: referenceError })
      return
    }

    const form = new FormData(event.currentTarget)
    const slotLabel = selectedSlot ? formatSlot(selectedSlot, language) : ''
    let createdRequestId = ''

    setSubmitState({ type: 'loading', stage: 'booking' })

    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlotId,
          name: form.get('name'),
          contact: form.get('contact'),
          idea: form.get('idea'),
          budget: form.get('budget'),
          privacyAccepted: form.get('privacyAccepted') === 'on',
          turnstileToken: form.get('cf-turnstile-response'),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to send booking request.')
      }

      createdRequestId = data.requestId
      setSlots((current) => current.filter((slot) => slot.id !== selectedSlotId))

      await uploadReferences(createdRequestId)

      setSubmitState({
        type: 'success',
        requestId: createdRequestId,
        slotLabel,
      })
    } catch (error) {
      if (createdRequestId) {
        setSubmitState({
          type: 'success',
          requestId: createdRequestId,
          slotLabel,
          referenceWarning: referenceFiles.length > 0,
        })
        return
      }

      if (turnstileSiteKey) window.turnstile?.reset?.()
      setSubmitState({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to send booking request.',
      })
    }
  }

  if (submitState.type === 'success') {
    return (
      <div className="booking-success" role="status">
        <span className="booking-success-heart" aria-hidden="true">♡</span>
        <h2>{t.successTitle}</h2>
        <p>{t.successText}</p>
        {submitState.slotLabel ? <strong>{submitState.slotLabel}</strong> : null}
        {referenceFiles.length > 0 && !submitState.referenceWarning ? <p className="booking-success-references">{t.successReferences}</p> : null}
        {submitState.referenceWarning ? <p className="booking-reference-warning">{t.referenceWarning}</p> : null}
      </div>
    )
  }

  const submitting = submitState.type === 'loading'
  const submitLabel = submitState.type === 'loading' && submitState.stage === 'references'
    ? `${t.uploading} ${submitState.current}/${submitState.total}…`
    : submitState.type === 'loading'
      ? t.sending
      : t.send

  return (
    <form className="booking-form" onSubmit={onSubmit}>
      <fieldset className="booking-fieldset">
        <legend>{t.choose}</legend>

        {slotsLoading ? <p className="booking-muted">{t.loading}</p> : null}
        {slotsError ? <p className="booking-error">Unable to load available times.</p> : null}
        {!slotsLoading && !slotsError && slots.length === 0 ? <p className="booking-muted">{t.none}</p> : null}

        {!slotsLoading && !slotsError && slots.length > 0 ? (
          <div className="booking-calendar-wrap">
            <div className="booking-calendar-head">
              <button type="button" onClick={() => navigateMonth(-1)} disabled={monthKey <= currentMonthKey || submitting} aria-label="Previous month">‹</button>
              <strong>{formatMonth(monthKey, language)}</strong>
              <button type="button" onClick={() => navigateMonth(1)} disabled={submitting} aria-label="Next month">›</button>
            </div>

            <div className="booking-calendar-weekdays">
              {weekdays.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="booking-calendar-grid">
              {cells.map((dateKey, index) => {
                if (!dateKey) return <div className="booking-calendar-empty" key={`empty-${index}`} />
                const daySlots = slotsByDate.get(dateKey) || []
                const available = daySlots.length > 0
                const selected = dateKey === selectedDate
                const isToday = dateKey === today
                return (
                  <button
                    type="button"
                    className={`booking-calendar-day${available ? ' has-times' : ''}${selected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                    key={dateKey}
                    disabled={!available || submitting}
                    onClick={() => chooseDate(dateKey)}
                    aria-pressed={selected}
                    aria-label={`${formatCalendarDate(dateKey, language)} · ${daySlots.length}`}
                  >
                    <strong>{Number(dateKey.slice(-2))}</strong>
                    <span aria-hidden="true">
                      {daySlots.slice(0, 3).map((slot) => <i key={slot.id} />)}
                      {daySlots.length > 3 ? <small>+{daySlots.length - 3}</small> : null}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="booking-calendar-times">
              {selectedDate ? (
                <>
                  <div className="booking-calendar-times-head"><span>{t.availableOn}</span><b>{formatCalendarDate(selectedDate, language)}</b></div>
                  <div className="booking-slots">
                    {selectedDaySlots.map((slot) => {
                      const active = slot.id === selectedSlotId
                      return (
                        <button
                          type="button"
                          className={active ? 'booking-slot active' : 'booking-slot'}
                          key={slot.id}
                          aria-pressed={active}
                          disabled={submitting}
                          onClick={() => {
                            setSelectedSlotId(slot.id)
                            if (submitState.type === 'error') setSubmitState({ type: 'idle' })
                          }}
                        >
                          <span>{formatSlotTime(slot, language)}</span>
                          <small>{durationLabel(slot)} · Tampere</small>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : <p className="booking-muted">{t.selectDay}</p>}
            </div>
          </div>
        ) : null}
      </fieldset>

      <div className="booking-fields-grid">
        <label className="booking-field">
          <span>{t.name}</span>
          <input name="name" type="text" required maxLength={100} autoComplete="name" disabled={submitting} />
        </label>

        <label className="booking-field">
          <span>{t.contact}</span>
          <input name="contact" type="text" required maxLength={200} placeholder="@username" disabled={submitting} />
        </label>
      </div>

      <label className="booking-field">
        <span>{t.idea}</span>
        <textarea name="idea" required maxLength={5000} rows={6} disabled={submitting} />
      </label>

      <label className="booking-field booking-budget">
        <span>{t.budget}</span>
        <input name="budget" type="text" maxLength={200} placeholder="150–200 €" disabled={submitting} />
      </label>

      <div className="booking-reference-upload">
        <div className="booking-reference-copy">
          <b>{t.references}</b>
          <p>{t.referencesNote}</p>
        </div>

        <label className="booking-file-button">
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={onReferenceChange}
            disabled={submitting}
          />
          <span>＋ {t.chooseReferences}</span>
        </label>

        {referenceFiles.length > 0 ? (
          <div className="booking-file-list">
            {referenceFiles.map((reference) => (
              <div className="booking-file-chip" key={reference.key}>
                <span><b>{reference.file.name}</b><small>{formatFileSize(reference.file.size)}</small></span>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setReferenceFiles((current) => current.filter((item) => item.key !== reference.key))
                    setReferenceError('')
                  }}
                >
                  {t.remove}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {referenceError ? <p className="booking-error" role="alert">{referenceError}</p> : null}
      </div>

      {turnstileSiteKey ? (
        <div className="booking-turnstile">
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="light" data-action="booking" />
        </div>
      ) : null}

      <label className="booking-consent">
        <input name="privacyAccepted" type="checkbox" required disabled={submitting} />
        <span>{t.privacyBefore} <a href="/privacy" target="_blank" rel="noreferrer">{t.privacyLink}</a> {t.privacyAfter}</span>
      </label>

      {submitState.type === 'error' ? <p className="booking-error" role="alert">{submitState.message}</p> : null}

      <button className="primary-button booking-submit" type="submit" disabled={submitting || slots.length === 0 || !selectedSlotId}>
        {submitLabel}
      </button>
    </form>
  )
}
