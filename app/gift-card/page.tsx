'use client'

import { ArrowUpRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { useLanguage } from '@/components/language-provider'
import { instagram } from '@/app/data'
import '@/app/gift-card.css'

const copy = {
  en: {
    label: 'Gift cards',
    titleA: 'Give a little',
    titleB: 'piece of magic.',
    intro: 'kisu.tatts gift cards can be bought directly from Eva — in the studio after a session or by messaging her online.',
    howTitle: 'How it works',
    steps: [
      ['1', 'Choose the value', 'Tell Eva how much you would like to put on the gift card.'],
      ['2', 'Pay Eva directly', 'Payment is arranged with Eva in the usual way. There is no online checkout yet.'],
      ['3', 'Get the card', 'Eva creates a personal digital gift card with a unique code and sends it to you.'],
      ['4', 'Use it for a tattoo', 'The recipient can enter the code when sending a booking request or show it to Eva later.'],
    ],
    note: 'A gift card is a payment method. It does not reserve a time or guarantee a booking — appointments are confirmed by Eva separately.',
    contact: 'Ask Eva for a gift card',
    book: 'Already have a gift card? Book here',
  },
  fi: {
    label: 'Lahjakortit',
    titleA: 'Anna pieni',
    titleB: 'pala taikaa.',
    intro: 'kisu.tatts-lahjakortin voi ostaa suoraan Evalta — studiossa tatuointikäynnin jälkeen tai viestillä verkossa.',
    howTitle: 'Näin se toimii',
    steps: [
      ['1', 'Valitse arvo', 'Kerro Evalle, minkä summan haluat lahjakortille.'],
      ['2', 'Maksa suoraan Evalle', 'Maksu sovitaan Evan kanssa tavalliseen tapaan. Verkkokassaa ei vielä ole.'],
      ['3', 'Saat lahjakortin', 'Eva luo henkilökohtaisen digitaalisen lahjakortin yksilöllisellä koodilla ja lähettää sen sinulle.'],
      ['4', 'Käytä tatuointiin', 'Saaja voi syöttää koodin varauspyynnön yhteydessä tai näyttää sen Evalle myöhemmin.'],
    ],
    note: 'Lahjakortti on maksutapa. Se ei varaa aikaa eikä takaa varausta — Eva vahvistaa ajan erikseen.',
    contact: 'Kysy lahjakorttia Evalta',
    book: 'Onko sinulla jo lahjakortti? Varaa tästä',
  },
} as const

export default function GiftCardInfoPage() {
  const { language } = useLanguage()
  const t = copy[language]

  return (
    <main className="site-shell">
      <SiteHeader />
      <div className="page-wrap gift-info-page">
        <div className="section-label">♡ {t.label}</div>
        <h1 className="page-title">{t.titleA}<br /><span>{t.titleB}</span></h1>
        <p className="page-intro">{t.intro}</p>

        <section className="gift-info-preview">
          <div className="gift-certificate">
            <div className="gift-certificate-brand">kisu<i>.tatts</i></div>
            <p className="gift-certificate-label">♡ Gift card</p>
            <div className="gift-certificate-amount">150 €</div>
            <p className="gift-certificate-for">for <strong>someone lovely</strong></p>
            <div className="gift-certificate-code"><span>Gift card code<code>KISU-XXXXXX-XXXXXX</code></span><b className="gift-certificate-status">Active</b></div>
          </div>
        </section>

        <section className="gift-how">
          <h2>{t.howTitle}</h2>
          <div className="gift-how-grid">
            {t.steps.map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </article>
            ))}
          </div>
          <p className="gift-info-note">♡ {t.note}</p>
          <div className="gift-public-actions">
            <a href={instagram} target="_blank" rel="noreferrer">{t.contact} <ArrowUpRight size={14} /></a>
            <a href="/booking">{t.book}</a>
          </div>
        </section>
      </div>
    </main>
  )
}
