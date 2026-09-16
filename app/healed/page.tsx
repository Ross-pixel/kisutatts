'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { useLanguage } from '@/components/language-provider'
import { translations } from '@/data/translations'

export default function HealedPage() {
  const { language } = useLanguage()
  const t = translations[language]
  return <main className="site-shell"><SiteHeader /><div className="page-wrap">
    <Link className="back-link" href="/"><ArrowLeft size={15} /> {t.pages.backHome}</Link>
    <div className="section-label">♡ {t.healed.label}</div>
    <h1 className="page-title">{t.pages.healedTitle}</h1>
    <p className="page-intro">{t.healed.text}</p>
    <div className="healed-gallery">{[1,2,3,4,5,6].map((item) => <div className="healed-card healed-large" key={item}><span>♡</span><small>{t.healed.placeholder}</small></div>)}</div>
    <Link className="text-link" href="/">{t.pages.backHome} <ArrowUpRight size={15} /></Link>
  </div></main>
}
