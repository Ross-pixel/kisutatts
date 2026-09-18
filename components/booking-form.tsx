'use client'

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
    referencesNote: 'Up to 5 images · JPEG, PNG, WebP, HEIC or HEIF · max 10 MB each. Photos are stored privately.',
    chooseReferences: 'Choose photos',
    remove: 'Remove',
    fileType: 'Reference photos must be JPEG, PNG, WebP, HEIC or HEIF.',
    fileSize: 'Each reference photo must be 10 MB or smaller.',
    fileCount: 'You can attach up to 5 reference photos.',
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
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [slotsError, setSlotsError] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState('')
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

        <div className="booking-slots">
          {slots.map((slot) => {
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

      {submitState.type === 'error' ? <p className="booking-error" role="alert">{submitState.message}</p> : null}

      <button className="primary-button booking-submit" type="submit" disabled={submitting || slots.length === 0}>
        {submitLabel}
      </button>
    </form>
  )
}
