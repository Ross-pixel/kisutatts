'use client'

import { useState } from 'react'

import { SiteHeader } from '@/components/site-header'
import { LightboxImage } from '@/components/lightbox-image'
import { portfolio } from '../data'
import { useLanguage } from '@/components/language-provider'
import { useTinaContent } from '@/components/tina-content'
import { PortfolioConnectionDocument } from '@/tina/__generated__/types'

type PortfolioItem = {
  title: string
  category: string
  description?: string
  sketch?: string
  onSkin?: string
  healed?: string
  featured?: boolean
  image?: string
}

function CaseImage({ src, alt, label }: { src?: string; alt: string; label: string }) {
  if (!src) return null
  return <div className="portfolio-case-media">
    <LightboxImage className="portfolio-case-image" src={src} alt={alt} />
    <span>{label}</span>
  </div>
}

export default function PortfolioPage() {
  const { language } = useLanguage()
  const [filter, setFilter] = useState('All')
  const cms = useTinaContent<any>(PortfolioConnectionDocument, { first: 100 }, { portfolioConnection: { edges: [] } })

  const cmsItems: PortfolioItem[] = cms.portfolioConnection?.edges?.map((edge: any) => ({
    title: edge.node.title,
    category: edge.node.category ?? 'Custom',
    description: edge.node.description,
    sketch: edge.node.sketch,
    onSkin: edge.node.onSkin,
    healed: edge.node.healed,
    featured: edge.node.featured,
    image: edge.node.image,
  })) ?? []

  const fallbackItems: PortfolioItem[] = portfolio.map((item) => ({
    title: item[0],
    category: item[0],
    description: item[1],
  }))

  const allItems = cmsItems.length ? cmsItems : fallbackItems
  const visible = filter === 'All' ? allItems : allItems.filter((item) => item.category === filter)
  const filters = language === 'fi'
    ? ['Kaikki', 'Flora', 'B&W', 'Color', 'ALT', 'Custom']
    : ['All', 'Flora', 'B&W', 'Color', 'ALT', 'Custom']

  return <main className="site-shell">
    <SiteHeader />
    <section className="section portfolio-page">
      <div className="section-label">✦ {language === 'fi' ? 'Portfolio / työt ja tarinat' : 'Portfolio / work & stories'}</div>
      <h1 className="page-title">
        {language === 'fi' ? <>Pieniä töitä,<br /><span>isoja tarinoita.</span></> : <>Little tattoos,<br /><span>their stories.</span></>}
      </h1>
      <p className="portfolio-intro">
        {language === 'fi'
          ? 'Jokainen tatuointi alkaa ideasta. Tutustu matkaan luonnoksesta iholle ja, jos mahdollista, parantuneeseen lopputulokseen.'
          : 'Every tattoo starts with an idea. Follow the journey from sketch to skin and, when available, the healed result.'}
      </p>

      <div className="filter-row portfolio-filters">
        {filters.map((label, index) => {
          const value = index === 0 ? 'All' : label === 'Kaikki' ? 'All' : label
          return <button key={label} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
        })}
      </div>

      <div className="portfolio-cases">
        {visible.map((item, index) => {
          const legacyImage = item.onSkin || item.image
          const hasStory = Boolean(item.sketch || item.onSkin || item.healed || item.description)
          return <article className="portfolio-case" key={`${item.title}-${index}`}>
            <div className="portfolio-case-header">
              <div>
                <div className="portfolio-case-number">{String(index + 1).padStart(2, '0')}</div>
                <h2>{item.title}</h2>
                <span className="portfolio-case-category">{item.category}</span>
              </div>
              {item.featured && <span className="portfolio-featured">♡ Featured</span>}
            </div>

            {item.description && <p className="portfolio-case-description">{item.description}</p>}

            {hasStory ? <div className="portfolio-case-grid">
              <CaseImage src={item.sketch} alt={`${item.title} sketch`} label={language === 'fi' ? 'Luonnos' : 'Sketch'} />
              <CaseImage src={item.onSkin || item.image} alt={`${item.title} on skin`} label={language === 'fi' ? 'Iholla' : 'On skin'} />
              <CaseImage src={item.healed} alt={`${item.title} healed`} label={language === 'fi' ? 'Parantunut' : 'Healed'} />
            </div> : legacyImage ? <div className="portfolio-case-grid single">
              <CaseImage src={legacyImage} alt={item.title} label={language === 'fi' ? 'Työ' : 'Work'} />
            </div> : <div className="portfolio-case-empty">{language === 'fi' ? 'Kuvia lisätään pian ♡' : 'Photos coming soon ♡'}</div>}
          </article>
        })}
      </div>
    </section>
  </main>
}
