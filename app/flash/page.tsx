'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { useLanguage } from '@/components/language-provider'
import { flash, fiFlash, prices } from '@/app/data'
import { translations } from '@/data/translations'

const designs = ['stars', 'ghost', 'mushroom', 'cat', 'jellyfish', 'witch', 'bug', 'skeleton', 'heart', 'sword']

export default function FlashPage() {
  const { language } = useLanguage()
  const t = translations[language]
  const rows = language === 'fi' ? fiFlash : flash
  return <main className="site-shell"><SiteHeader /><div className="page-wrap">
    <Link className="back-link" href="/"> <ArrowLeft size={15} /> {t.pages.backHome}</Link>
    <div className="section-label">✦ {t.pages.flashLabel}</div>
    <h1 className="page-title">{t.pages.flashTitle}</h1>
    <p className="page-intro">{t.pricing.intro}</p>
    <div className="flash-list full-flash-list">{rows.map((row, index) => <div className="flash-row" key={row[0]}><strong>{prices[index]}</strong><span><b>{row[0]}</b><small>{row[1]}</small></span><i>+</i></div>)}</div>
    <p className="price-note">{t.pricing.note}</p>
    <div className="section-label page-sub-label">♡ {t.pages.flashGallery}</div>
    <div className="flash-gallery">{designs.map((design, index) => <div className={`flash-tile art-${design}`} key={design}><span className="art-shape" /><small>{rows[index % rows.length][0]}</small></div>)}</div>
    <Link className="text-link" href="/">{t.pages.backHome} <ArrowUpRight size={15} /></Link>
  </div></main>
}
