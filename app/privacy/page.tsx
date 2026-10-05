'use client'

import { ArrowLeft } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { useLanguage } from '@/components/language-provider'

const copy = {
  en: {
    label: 'Privacy',
    titleA: 'Booking',
    titleB: 'privacy notice.',
    intro: 'This notice explains what information is used when you send a tattoo booking request or use a kisu.tatts gift card.',
    back: 'Back to booking',
    sections: [
      ['What is collected', 'Your name, contact details, tattoo idea, optional budget, selected appointment time, optional gift card code and any reference images you choose to upload. Technical anti-abuse data may also be processed when spam protection is enabled.'],
      ['Why it is used', 'The information is used to review your tattoo request, arrange the appointment, communicate with you, manage the booking calendar and, if you provide a gift card code, link the valid gift card to the request. Entering a gift card code does not redeem any balance.'],
      ['Gift cards', 'When Eva issues a gift card, its records can include the recipient name, optional sender name and message, buyer contact details, value, remaining balance, status, internal note and transaction history. These records are kept privately and are used to issue, verify and redeem the gift card and to maintain an accurate balance history.'],
      ['Photos and access', 'Reference images are stored privately. They are not part of the public portfolio and are available only through Eva’s private booking tools.'],
      ['Retention', 'Pending and confirmed booking information is kept while it is needed to manage the appointment. Rejected or cancelled requests are scheduled for deletion after about 6 months, and completed booking data after about 12 months, unless it needs to be retained longer for a legal, accounting or dispute-related reason. Gift card records are kept for as long as needed to honour the card, maintain its balance history and meet applicable accounting, legal or dispute-related obligations.'],
      ['Spam protection', 'The booking form can use Cloudflare Turnstile to prevent automated abuse. When enabled, Cloudflare may process technical information needed to determine whether a request is legitimate.'],
      ['Your choices', 'You can ask Eva to correct or delete information where applicable. The easiest way to contact her about privacy is through the same contact channel you used for the booking or gift card, or via @kisu.tatts on Instagram.'],
    ],
    version: 'Notice version: 5 October 2026',
  },
  fi: {
    label: 'Tietosuoja',
    titleA: 'Varauksen',
    titleB: 'tietosuojailmoitus.',
    intro: 'Tässä ilmoituksessa kerrotaan, mitä tietoja käytetään, kun lähetät tatuointia koskevan varauspyynnön tai käytät kisu.tatts-lahjakorttia.',
    back: 'Takaisin varaukseen',
    sections: [
      ['Mitä tietoja kerätään', 'Nimi, yhteystiedot, tatuointi-idea, vapaaehtoinen budjetti, valitsemasi aika, mahdollinen lahjakortin koodi sekä itse lähettämäsi referenssikuvat. Roskapostisuojauksen ollessa käytössä voidaan käsitellä myös teknisiä väärinkäytösten estämiseen tarvittavia tietoja.'],
      ['Mihin tietoja käytetään', 'Tietoja käytetään tatuointipyynnön käsittelyyn, ajan sopimiseen, yhteydenpitoon, varauskalenterin hallintaan sekä mahdollisen voimassa olevan lahjakortin liittämiseen varauspyyntöön. Lahjakortin koodin syöttäminen ei vähennä sen saldoa.'],
      ['Lahjakortit', 'Kun Eva myöntää lahjakortin, sen tietoihin voi sisältyä saajan nimi, vapaaehtoinen lähettäjän nimi ja viesti, ostajan yhteystieto, arvo, jäljellä oleva saldo, tila, sisäinen muistiinpano sekä tapahtumahistoria. Tiedot säilytetään yksityisesti, ja niitä käytetään lahjakortin myöntämiseen, tarkistamiseen ja lunastamiseen sekä saldon luotettavaan ylläpitoon.'],
      ['Kuvat ja käyttöoikeus', 'Referenssikuvat tallennetaan yksityisesti. Ne eivät kuulu julkiseen portfolioon, ja niitä käsitellään vain Evan yksityisissä varaustyökaluissa.'],
      ['Säilytysaika', 'Odottavia ja vahvistettuja varaustietoja säilytetään niin kauan kuin ajan hoitaminen sitä edellyttää. Hylätyt tai perutut pyynnöt on tarkoitus poistaa noin 6 kuukauden kuluttua ja toteutuneiden varausten tiedot noin 12 kuukauden kuluttua, ellei tietoja tarvitse säilyttää pidempään esimerkiksi oikeudellisen, kirjanpidollisen tai riitatilanteeseen liittyvän syyn vuoksi. Lahjakorttitietoja säilytetään niin kauan kuin niitä tarvitaan kortin voimassaolon, saldohistorian sekä soveltuvien kirjanpidollisten, oikeudellisten tai riitatilanteisiin liittyvien velvoitteiden vuoksi.'],
      ['Roskapostisuojaus', 'Varauslomake voi käyttää Cloudflare Turnstile -palvelua automaattisen väärinkäytön estämiseen. Kun suojaus on käytössä, Cloudflare voi käsitellä teknisiä tietoja, joita tarvitaan pyynnön aitouden arvioimiseen.'],
      ['Omat oikeutesi', 'Voit pyytää Evaa korjaamaan tai poistamaan tietojasi soveltuvin osin. Helpoin tapa ottaa yhteyttä tietosuoja-asioissa on sama yhteyskanava, jota käytit varaukseen tai lahjakorttiin, tai Instagramissa @kisu.tatts.'],
    ],
    version: 'Ilmoituksen versio: 5. lokakuuta 2026',
  },
} as const

export default function PrivacyPage() {
  const { language } = useLanguage()
  const t = copy[language]

  return (
    <main className="site-shell">
      <SiteHeader />
      <div className="page-wrap">
        <a className="back-link" href="/booking"><ArrowLeft size={15} /> {t.back}</a>
        <div className="section-label">♡ {t.label}</div>
        <h1 className="page-title">{t.titleA}<br /><span>{t.titleB}</span></h1>
        <p className="page-intro">{t.intro}</p>

        {t.sections.map(([title, body]) => (
          <section className="section" key={title}>
            <h2>{title}</h2>
            <p className="body-copy">{body}</p>
          </section>
        ))}

        <p className="body-copy"><small>{t.version}</small></p>
      </div>
    </main>
  )
}
