'use client'

import { SiteHeader } from '@/components/site-header'
import { useLanguage } from '@/components/language-provider'

export default function FAQPage() {
  const { t } = useLanguage()
  return <main className="site-shell"><SiteHeader /><section className="section faq-page max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="section-label">♡ {t.faq.label} / aftercare</div>
    <h1 className="page-title">{t.faq.title}</h1>
    <div className="faq-list">{t.faq.questions.map(([question, answer]) => <article className="faq-item" key={question}><h2>{question}</h2><p>{answer}</p></article>)}</div>
    <section className="aftercare" aria-labelledby="aftercare-title">
      <h2 id="aftercare-title">{t.aftercare.title} ♡</h2>
      <div className="aftercare-timeline">{t.aftercare.days.map((day) => <article className="aftercare-card" key={day.title}><div className="aftercare-card-head"><span className="aftercare-icon" aria-hidden="true">{day.icon}</span><h3>{day.title}</h3></div><p>{day.text}</p></article>)}</div>
      <article className="aftercare-warning"><h3>{t.aftercare.warningTitle}</h3><p>{t.aftercare.warning}</p></article>
    </section>
  </section></main>
}
