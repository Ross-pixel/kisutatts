'use client'

import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { tinaField } from 'tinacms/dist/react'
import { SiteHeader } from '@/components/site-header'
import { LightboxImage } from '@/components/lightbox-image'
import { useLanguage } from '@/components/language-provider'
import { flash, fiFlash, prices } from '@/app/data'
import { translations } from '@/data/translations'
import { useTinaContent } from '@/components/tina-content'
import { FlashDesignsConnectionDocument } from '@/tina/__generated__/types'

const designs = ['stars', 'ghost', 'mushroom', 'cat', 'jellyfish', 'witch', 'bug', 'skeleton', 'heart', 'sword']

const HOMEPAGE_PRICING_INTRO_QUERY = `
  query HomepagePricingIntro($relativePath: String!) {
    homepage(relativePath: $relativePath) {
      priceIntroEn
      priceIntroFi
    }
  }
`

const PRICING_QUERY = `
  query FlashPricing($relativePath: String!) {
    pricing(relativePath: $relativePath) {
      title
      items {
        priceMin
        priceMax
        titleEn
        titleFi
        descriptionEn
        descriptionFi
      }
    }
  }
`

const fallbackPricingItems = prices.map((price, index) => {
  const matches = price.match(/\d+/g) || []
  return {
    priceMin: Number(matches[0] || 0),
    priceMax: matches[1] ? Number(matches[1]) : null,
    titleEn: flash[index]?.[0] || '',
    titleFi: fiFlash[index]?.[0] || flash[index]?.[0] || '',
    descriptionEn: flash[index]?.[1] || '',
    descriptionFi: fiFlash[index]?.[1] || flash[index]?.[1] || '',
  }
})

function normalizeImageSrc(src: unknown) {
  if (typeof src !== 'string' || !src) return null
  return src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://') ? src : `/${src}`
}

function formatPrice(item: any) {
  const min = Number(item?.priceMin)
  const max = Number(item?.priceMax)
  if (!Number.isFinite(min)) return ''
  return Number.isFinite(max) && max > min ? `${min}–${max}€` : `${min}€`
}

export default function FlashPage() {
  const { language } = useLanguage()
  const t = translations[language]
  const cms = useTinaContent<any>(FlashDesignsConnectionDocument, { first: 100 }, { flashDesignsConnection: { edges: [] } })
  const introCms = useTinaContent<any>(
    HOMEPAGE_PRICING_INTRO_QUERY,
    { relativePath: 'home.mdx' },
    { homepage: { priceIntroEn: t.pricing.intro, priceIntroFi: t.pricing.intro } },
  )
  const pricingCms = useTinaContent<any>(
    PRICING_QUERY,
    { relativePath: 'prices.mdx' },
    { pricing: { title: 'Flash pricing', items: fallbackPricingItems } },
  )
  const homepage = introCms.homepage || {}
  const pricing = pricingCms.pricing || {}
  const hasCmsPricing = Array.isArray(pricing.items) && pricing.items.length > 0
  const pricingItems = [...(hasCmsPricing ? pricing.items : fallbackPricingItems)]
    .sort((a: any, b: any) => Number(a?.priceMin ?? Infinity) - Number(b?.priceMin ?? Infinity))
  const priceIntroField = language === 'fi' ? 'priceIntroFi' : 'priceIntroEn'
  const priceIntro = language === 'fi'
    ? homepage.priceIntroFi || t.pricing.intro
    : homepage.priceIntroEn || t.pricing.intro
  const titleField = language === 'fi' ? 'titleFi' : 'titleEn'
  const descriptionField = language === 'fi' ? 'descriptionFi' : 'descriptionEn'
  const cmsDesigns = cms.flashDesignsConnection?.edges?.map((edge: any) => edge.node).filter(Boolean) ?? []
  const displayDesigns = cmsDesigns.length ? cmsDesigns : designs.map((name) => ({ title: name, category: 'Flash', image: null }))

  return <main className="site-shell"><SiteHeader /><div className="page-wrap max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <a className="back-link" href="/"> <ArrowLeft size={15} /> {t.pages.backHome}</a>
    <div className="section-label">✦ {t.pages.flashLabel}</div>
    <h1 className="page-title">{t.pages.flashTitle}</h1>
    <p className="page-intro" data-tina-field={tinaField(homepage, priceIntroField)}>{priceIntro}</p>
    <div className="flash-list full-flash-list">{pricingItems.map((row: any, index: number) => {
      const title = language === 'fi' ? row.titleFi || row.titleEn : row.titleEn || row.titleFi
      const description = language === 'fi' ? row.descriptionFi || row.descriptionEn : row.descriptionEn || row.descriptionFi
      return <div className="flash-row" key={`${row.priceMin}-${title}-${index}`} data-tina-field={hasCmsPricing ? tinaField(row) : undefined}>
        <strong data-tina-field={hasCmsPricing ? tinaField(row, 'priceMin') : undefined}>{formatPrice(row)}</strong>
        <span>
          <b data-tina-field={hasCmsPricing ? tinaField(row, titleField) : undefined}>{title}</b>
          <small data-tina-field={hasCmsPricing ? tinaField(row, descriptionField) : undefined}>{description}</small>
        </span>
        <i>+</i>
      </div>
    })}</div>
    <p className="price-note">{t.pricing.note}</p>
    <div className="section-label page-sub-label">♡ {t.pages.flashGallery}</div>
    <div className="flash-gallery">{displayDesigns.map((design: any, index: number) => {
      const imageSrc = normalizeImageSrc(design.image)
      return <div className={`flash-tile art-${designs[index % designs.length]}`} style={{ position: 'relative' }} key={design.id ?? design.title ?? index}>
        {imageSrc ? <LightboxImage className="portfolio-image" src={imageSrc} alt={design.title ?? 'Flash design'} /> : <span className="art-shape" />}
        <small>{design.title ?? pricingItems[index % Math.max(pricingItems.length, 1)]?.titleEn ?? 'Flash'}</small>
      </div>
    })}</div>
    <a className="text-link" href="/">{t.pages.backHome} <ArrowUpRight size={15} /></a>
  </div></main>
}
