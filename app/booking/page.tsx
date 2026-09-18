'use client'

import { ArrowLeft } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { BookingForm } from '@/components/booking-form'
import { useLanguage } from '@/components/language-provider'

const copy = {
  en: {
    label: 'Booking',
    titleA: 'Tell me about',
    titleB: 'your tattoo.',
    intro: 'Choose an available time and send your idea. The appointment is confirmed only after Eva reviews and accepts the request.',
    note: 'Submitting the form holds the selected time while your request is being reviewed.',
    back: 'Back to home',
  },
  fi: {
    label: 'Varaus',
    titleA: 'Kerro minulle',
    titleB: 'tatuoinnistasi.',
    intro: 'Valitse vapaa aika ja lähetä ideasi. Aika vahvistuu vasta, kun Eva on tarkistanut ja hyväksynyt pyynnön.',
    note: 'Lomakkeen lähettäminen varaa valitun ajan pyynnön käsittelyn ajaksi.',
    back: 'Takaisin etusivulle',
  },
} as const

export default function BookingPage() {
  const { language } = useLanguage()
  const t = copy[language]

  return (
    <main className="site-shell booking-page">
      <SiteHeader />
      <div className="page-wrap booking-page-wrap">
        <a className="back-link" href="/"><ArrowLeft size={15} /> {t.back}</a>
        <div className="section-label">♡ 06 / {t.label}</div>

        <section className="booking-page-head">
          <div>
            <h1 className="page-title">{t.titleA}<br /><span>{t.titleB}</span></h1>
            <p className="page-intro">{t.intro}</p>
          </div>
          <aside className="booking-note"><span aria-hidden="true">✦</span><p>{t.note}</p></aside>
        </section>

        <BookingForm />
      </div>
    </main>
  )
}
