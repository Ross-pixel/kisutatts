'use client'

import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { LightboxImage } from '@/components/lightbox-image'
import { useLanguage } from '@/components/language-provider'
import { translations } from '@/data/translations'
import { useTinaContent } from '@/components/tina-content'
import { OnSkinWorksConnectionDocument } from '@/tina/__generated__/types'

function normalizeImageSrc(src: unknown) {
  if (typeof src !== 'string' || !src) return null
  return src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://') ? src : `/${src}`
}

export default function OnSkinPage() {
  const { language } = useLanguage()
  const t = translations[language]
  const cms = useTinaContent<any>(OnSkinWorksConnectionDocument, { first: 100 }, { onSkinWorksConnection: { edges: [] } })
  const works = cms.onSkinWorksConnection?.edges?.map((edge: any) => edge.node).filter(Boolean) ?? []
  const displayWorks = works.length ? works : [1, 2, 3, 4, 5, 6].map((item) => ({ title: String(item), image: null }))

  return <main className="site-shell"><SiteHeader /><div className="page-wrap max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <a className="back-link" href="/"><ArrowLeft size={15} /> {t.pages.backHome}</a>
    <div className="section-label">♡ {t.onSkin.label}</div>
    <h1 className="page-title">{t.pages.onSkinTitle}</h1>
    <p className="page-intro">{t.onSkin.text}</p>
    <div className="healed-gallery">{displayWorks.map((item: any, index: number) => {
      const imageSrc = normalizeImageSrc(item.image)
      return <div className="healed-card healed-large" style={{ position: 'relative' }} key={item.id ?? item.title ?? index}>
        {imageSrc ? <LightboxImage className="portfolio-image" src={imageSrc} alt={item.title ?? (t.onSkin as any).title} /> : <span>♡</span>}
        <small>{item.title ?? t.onSkin.placeholder}</small>
      </div>
    })}</div>
    <a className="text-link" href="/"><ArrowUpRight size={15} /> {t.pages.backHome}</a>
  </div></main>
}
