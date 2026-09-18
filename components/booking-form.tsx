'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/components/language-provider'

type BookingSlot = {
  id: string
  starts_at: string
  ends_at: string
}

type SubmitState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; requestId: string }
  | { type: 'error'; message: string }

const copy = {
  en: {
    choose: 'Choose a time',
    loading: 'Loading available times…',
    none: 'No available times right now. Check back soon or message Eva on Instagram.',
    name: 'Name',
    contact: 'Instagram / Telegram / other contact',
    idea: 'Idea or existing sketch number',
    budget: 'Budget (optional)',
    references: 'Reference photos',
    referencesNote: 'Photo upload is the next step of the booking build. For this test version, describe references in the idea field.',
    send: 'Send booking request',
    sending: 'Sending…',
    successTitle: 'Request sent ♡',
    successText: 'Eva will review the idea before confirming the appointment. This slot is now held for your request.',
    pickSlot: 'Please choose a time first.',
  },
  fi: {
    choose: 'Valitse aika',
    loading: 'Ladataan vapaita aikoja…',
    none: 'Vapaita aikoja ei ole juuri nyt. Tarkista myöhemmin tai laita Evalle viesti Instagramissa.',
    name: 'Nimi',
    contact: 'Instagram / Telegram / muu yhteystieto',
    idea: 'Idea tai valmiin luonnoksen numero',
    budget: 'Budjetti (valinnainen)',
    references: 'Referenssikuvat',
    referencesNote: 'Kuvien lähetys kytketään seuraavassa vaiheessa. Testiversiossa voit kuvailla referenssit ideakentässä.',
    send: 'Lähetä varauspyyntö',
    sending: 'Lähetetään…',
    successTitle: 'Pyyntö lähetetty ♡',
    successText: 'Eva tarkistaa idean ennen ajan vahvistamista. Tämä aika on nyt varattu pyynnöllesi.',
    pickSlot: 'Valitse ensin aika.',
  },
} as const

function formatSlot(slot: BookingSlot, language: 'en' | 'fi') {
  const locale = language === 'fi' ? 'fi-FI' : 'en-FI'
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: 'Europe/Helsinki',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(slot.starts_at))

  const time = new Intl.DateTimeFormat(locale, {
    timeZone: 'Europe/Helsinki',
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${day} · ${time.format(new Date(slot.starts_at))}–${time.format(new Date(slot.ends_at))}`
}

export function BookingForm() {
  const { language } = useLanguage()
  const t = copy[language]
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [slotsError, setSlotsError] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState('')
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
        setSlots(Array.isArray(data) ? data : [])
        setSlotsError(false)
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedSlotId) {
      setSubmitState({ type: 'error', message: t.pickSlot })
      return
    }

    const form = new FormData(event.currentTarget)

    setSubmitState({ type: 'loading' })

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
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to send booking request.')
      }

      setSubmitState({ type: 'success', requestId: data.requestId })
      setSlots((current) => current.filter((slot) => slot.id !== selectedSlotId))
    } catch (error) {
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
        {selectedSlot ? <strong>{formatSlot(selectedSlot, language)}</strong> : null}
      </div>
    )
  }

  return (
    <form className="booking-form" onSubmit={onSubmit}>
      <fieldset className="booking-fieldset">
        <legend>{t.choose}</legend>

        {slotsLoading ? <p className="booking-muted">{t.loading}</p> : null}
        {slotsError ? <p className="booking-error">Unable to load available times.</p> : null}
        {!slotsLoading && !slotsError && slots.length === 0 ? <p className="booking-muted">{t.none}</p> : null}

        <div className="booking-slots">
          {slots.map((slot) => {
            const active = slot.id === selectedSlotId
            return (
              <button
                type="button"
                className={active ? 'booking-slot active' : 'booking-slot'}
                key={slot.id}
                aria-pressed={active}
                onClick={() => {
                  setSelectedSlotId(slot.id)
                  if (submitState.type === 'error') setSubmitState({ type: 'idle' })
                }}
              >
                <span>{formatSlot(slot, language)}</span>
                <small>Tampere · Europe/Helsinki</small>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="booking-fields-grid">
        <label className="booking-field">
          <span>{t.name}</span>
          <input name="name" type="text" required maxLength={100} autoComplete="name" />
        </label>

        <label className="booking-field">
          <span>{t.contact}</span>
          <input name="contact" type="text" required maxLength={200} placeholder="@username" />
        </label>
      </div>

      <label className="booking-field">
        <span>{t.idea}</span>
        <textarea name="idea" required maxLength={5000} rows={6} />
      </label>

      <label className="booking-field booking-budget">
        <span>{t.budget}</span>
        <input name="budget" type="text" maxLength={200} placeholder="150–200 €" />
      </label>

      <div className="booking-reference-placeholder">
        <b>{t.references}</b>
        <p>{t.referencesNote}</p>
      </div>

      {submitState.type === 'error' ? <p className="booking-error" role="alert">{submitState.message}</p> : null}

      <button className="primary-button booking-submit" type="submit" disabled={submitState.type === 'loading' || slots.length === 0}>
        {submitState.type === 'loading' ? t.sending : t.send}
      </button>
    </form>
  )
}
