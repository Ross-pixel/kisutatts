'use client'

import { ArrowUpRight } from 'lucide-react'
import { tinaField } from 'tinacms/dist/react'
import { SiteHeader } from '@/components/site-header'
import { LightboxImage } from '@/components/lightbox-image'
import { useLanguage } from '@/components/language-provider'
import { copy, flash, fiFlash, instagram, portfolio, prices } from './data'
import { useTinaContent } from '@/components/tina-content'
import { PortfolioConnectionDocument, OnSkinWorksConnectionDocument } from '@/tina/__generated__/types'

const HOMEPAGE_QUERY = `
  query HomepageVisualEdit($relativePath: String!) {
    homepage(relativePath: $relativePath) {
      title
      heroTitle
      heroKickerEn
      heroKickerFi
      heroLeadEn
      heroLeadFi
      location
      heroImage
      aboutTitleEn
      aboutTitleFi
      aboutTextEn
      aboutTextFi
      aboutImage
      portfolioTitleTop
      portfolioTitleAccent
      portfolioTextEn
      portfolioTextFi
      onSkinTitleEn
      onSkinTitleFi
      onSkinTextEn
      onSkinTextFi
      priceIntroEn
      priceIntroFi
      pricingItems {
        price
        titleEn
        titleFi
        descriptionEn
        descriptionFi
      }
      contactTextEn
      contactTextFi
    }
  }
`

const fallbackPricingItems = prices.map((price, index) => ({
  price,
  titleEn: flash[index]?.[0] || '',
  titleFi: fiFlash[index]?.[0] || flash[index]?.[0] || '',
  descriptionEn: flash[index]?.[1] || '',
  descriptionFi: fiFlash[index]?.[1] || flash[index]?.[1] || '',
}))

function normalizeImageSrc(src: unknown) {
  if (typeof src !== 'string' || !src) return null
  return src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://') ? src : `/${src}`
}

function categoryClass(category: unknown) {
  return typeof category === 'string' ? category.toLowerCase().replace(/[^a-z]/g, '') || 'custom' : 'custom'
}

function priceSortValue(value: unknown) {
  if (typeof value !== 'string') return Number.POSITIVE_INFINITY
  const match = value.replace(',', '.').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY
}

const FallbackCard = ({ item }: { item: any }) => (
  <div className={`portfolio-card ${item[2]}`}>
    {item[3] ? <LightboxImage className="portfolio-image" src={item[3]} alt={item[0]} /> : <span className="art-shape" />}
    <span className="art-label"><b>{item[0]}</b><small>{item[1]}</small></span>
  </div>
)

function CmsPortfolioCard({ item }: { item: any }) {
  const imageField = item.onSkin ? 'onSkin' : item.image ? 'image' : item.sketch ? 'sketch' : null
  const imageSrc = imageField ? normalizeImageSrc(item[imageField]) : null
  return (
    <div className={`portfolio-card art-${categoryClass(item.category)}`} data-tina-field={tinaField(item)}>
      {imageSrc && imageField ? (
        <div data-tina-field={tinaField(item, imageField)} style={{ position: 'absolute', inset: 0 }}>
          <LightboxImage className="portfolio-image" src={imageSrc} alt={item.title || 'Portfolio work'} />
        </div>
      ) : <span className="art-shape" />}
      <span className="art-label">
        <b data-tina-field={tinaField(item, 'title')}>{item.title}</b>
        <small data-tina-field={tinaField(item, 'category')}>{item.category || 'Custom'}</small>
      </span>
    </div>
  )
}

const Deco = ({ children, className = '' }: { children: string; className?: string }) => <span className={`mood-deco ${className}`} aria-hidden="true">{children}</span>
const Constellation = ({ area }: { area: string }) => <div className={`deco-constellation deco-${area}`} aria-hidden="true"><i>♡</i><i>✦</i><i>✧</i></div>

export default function Page() {
  const { language } = useLanguage()
  const c = copy[language]

  const homepageCms = useTinaContent<any>(
    HOMEPAGE_QUERY,
    { relativePath: 'home.mdx' },
    {
      homepage: {
        title: 'Homepage',
        heroTitle: 'Eva',
        heroKickerEn: 'Tattoo artist in Tampere',
        heroKickerFi: 'Tattoo artist in Tampere',
        heroLeadEn: 'Colours, lines & shadows.',
        heroLeadFi: 'Colours, lines & shadows.',
        location: 'tampere, finland',
        heroImage: '/uploads/eva-photo-2.jpg',
        aboutTitleEn: copy.en.aboutTitle,
        aboutTitleFi: copy.fi.aboutTitle,
        aboutTextEn: copy.en.aboutText,
        aboutTextFi: copy.fi.aboutText,
        aboutImage: '/uploads/eva-photo.jpg',
        portfolioTitleTop: 'Little pieces',
        portfolioTitleAccent: 'of magic.',
        portfolioTextEn: 'Every piece is drawn with care.',
        portfolioTextFi: 'Every piece is drawn with care.',
        onSkinTitleEn: copy.en.onSkinTitle,
        onSkinTitleFi: copy.fi.onSkinTitle,
        onSkinTextEn: copy.en.onSkinText,
        onSkinTextFi: copy.fi.onSkinText,
        priceIntroEn: copy.en.priceIntro,
        priceIntroFi: copy.fi.priceIntro,
        pricingItems: fallbackPricingItems,
        contactTextEn: copy.en.contactText,
        contactTextFi: copy.fi.contactText,
      },
    },
  )
  const site = homepageCms.homepage || {}
  const localized = (enField: string, fiField: string, fallback: string) => (
    language === 'fi' ? site[fiField] || fallback : site[enField] || fallback
  )

  const cms = useTinaContent<any>(PortfolioConnectionDocument, { first: 100 }, { portfolioConnection: { edges: [] } })
  const onSkinCms = useTinaContent<any>(OnSkinWorksConnectionDocument, { first: 100 }, { onSkinWorksConnection: { edges: [] } })
  const cmsNodes = (cms.portfolioConnection?.edges ?? []).map((edge: any) => edge?.node).filter(Boolean)
  const featuredNodes = cmsNodes.filter((item: any) => item.featured === true)
  const homepagePortfolioNodes = featuredNodes.length ? featuredNodes : cmsNodes
  const onSkinWorks = onSkinCms.onSkinWorksConnection?.edges?.map((edge: any) => edge.node).filter(Boolean) ?? []
  const previewWorks = onSkinWorks.length ? onSkinWorks.slice(0, 3) : [1, 2, 3].map((i) => ({ title: String(i), image: null }))
  const hasCmsPricing = Array.isArray(site.pricingItems) && site.pricingItems.length > 0
  const pricingItems = [...(hasCmsPricing ? site.pricingItems : fallbackPricingItems)]
    .sort((a: any, b: any) => priceSortValue(a?.price) - priceSortValue(b?.price))

  const heroKickerField = language === 'fi' ? 'heroKickerFi' : 'heroKickerEn'
  const heroLeadField = language === 'fi' ? 'heroLeadFi' : 'heroLeadEn'
  const aboutTitleField = language === 'fi' ? 'aboutTitleFi' : 'aboutTitleEn'
  const aboutTextField = language === 'fi' ? 'aboutTextFi' : 'aboutTextEn'
  const portfolioTextField = language === 'fi' ? 'portfolioTextFi' : 'portfolioTextEn'
  const onSkinTitleField = language === 'fi' ? 'onSkinTitleFi' : 'onSkinTitleEn'
  const onSkinTextField = language === 'fi' ? 'onSkinTextFi' : 'onSkinTextEn'
  const priceIntroField = language === 'fi' ? 'priceIntroFi' : 'priceIntroEn'
  const contactTextField = language === 'fi' ? 'contactTextFi' : 'contactTextEn'
  const pricingTitleField = language === 'fi' ? 'titleFi' : 'titleEn'
  const pricingDescriptionField = language === 'fi' ? 'descriptionFi' : 'descriptionEn'

  const heroKicker = localized('heroKickerEn', 'heroKickerFi', 'Tattoo artist in Tampere')
  const heroLead = localized('heroLeadEn', 'heroLeadFi', 'Colours, lines & shadows.')
  const aboutTitle = localized('aboutTitleEn', 'aboutTitleFi', c.aboutTitle)
  const aboutText = localized('aboutTextEn', 'aboutTextFi', c.aboutText)
  const portfolioText = localized('portfolioTextEn', 'portfolioTextFi', 'Every piece is drawn with care.')
  const onSkinTitle = localized('onSkinTitleEn', 'onSkinTitleFi', c.onSkinTitle)
  const onSkinText = localized('onSkinTextEn', 'onSkinTextFi', c.onSkinText)
  const priceIntro = localized('priceIntroEn', 'priceIntroFi', c.priceIntro)
  const contactText = localized('contactTextEn', 'contactTextFi', c.contactText)

  return <main className="site-shell"><SiteHeader />
    <section className="hero grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"><Deco className="deco-hero">✦</Deco><Constellation area="hero-extra" /><div className="hero-copy"><p className="kicker" data-tina-field={tinaField(site, heroKickerField)}>✦ {heroKicker}</p><h1 data-tina-field={tinaField(site, 'heroTitle')}>{site.heroTitle || 'Eva'}<span className="dot">.</span></h1><p className="hero-lead" data-tina-field={tinaField(site, heroLeadField)}>{heroLead}<br /><em>Fin / Eng / Rus</em></p><div className="hero-actions"><a className="primary-button" href="/booking">{c.book} <ArrowUpRight size={16} /></a><a className="instagram-link" href={instagram} target="_blank" rel="noreferrer"><span aria-hidden="true">♡</span> @kisu.tatts</a></div></div><div className="avatar-card" data-tina-field={tinaField(site, 'heroImage')}><img className="site-photo hero-photo" src={normalizeImageSrc(site.heroImage) || '/uploads/eva-photo-2.jpg'} alt="Eva, tattoo artist" /><span className="sticker sticker-one">♡</span><p data-tina-field={tinaField(site, 'location')}>{site.location || 'tampere, finland'}</p></div></section>
    <section className="section max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 about-section" id="about"><Deco className="deco-about">♡</Deco><Constellation area="about-extra" /><div className="section-label">♡ 01 / {c.about}</div><div className="about-grid"><div className="about-photo" data-tina-field={tinaField(site, 'aboutImage')}><img className="site-photo about-photo-image" src={normalizeImageSrc(site.aboutImage) || '/uploads/eva-photo.jpg'} alt="Eva, tattoo artist" /><span className="site-photo-caption">Eva</span></div><div className="about-text"><h2 data-tina-field={tinaField(site, aboutTitleField)}>{aboutTitle}</h2><p className="body-copy" data-tina-field={tinaField(site, aboutTextField)}>{aboutText}</p><p className="signature">Eva ♡</p></div></div></section>
    <section className="section max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 portfolio-section"><Deco className="deco-portfolio">✧</Deco><Constellation area="portfolio-extra" /><div className="section-label">✦ 02 / {c.portfolio}</div><div className="section-head"><h2><strong data-tina-field={tinaField(site, 'portfolioTitleTop')} style={{ fontWeight: 'inherit' }}>{site.portfolioTitleTop || 'Little pieces'}</strong><br /><span data-tina-field={tinaField(site, 'portfolioTitleAccent')}>{site.portfolioTitleAccent || 'of magic.'}</span></h2><p><span data-tina-field={tinaField(site, portfolioTextField)}>{portfolioText}</span><br /><a className="inline-instagram" href={instagram} target="_blank" rel="noreferrer">More work on Instagram <ArrowUpRight size={14} /></a></p></div><div className="portfolio-grid">{homepagePortfolioNodes.length ? homepagePortfolioNodes.slice(0, 3).map((item: any, index: number) => <CmsPortfolioCard key={item.id ?? item._sys?.filename ?? `${item.title}-${index}`} item={item} />) : portfolio.slice(0, 3).map((item: any) => <FallbackCard key={item[0]} item={item} />)}</div><a className="text-link" href="/portfolio">View all portfolio <ArrowUpRight size={15} /></a></section>
    <section className="section max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 healed-section"><Deco className="deco-onskin">♡</Deco><Constellation area="onskin-extra" /><div className="section-label">♡ 03 / {onSkinTitle}</div><div className="healed-head"><h2 data-tina-field={tinaField(site, onSkinTitleField)}>{onSkinTitle}</h2><p data-tina-field={tinaField(site, onSkinTextField)}>{onSkinText}</p></div><div className="healed-grid">{previewWorks.map((item: any, index: number) => <div className="healed-card" style={{ position: 'relative' }} key={item.id ?? item._sys?.filename ?? item.title ?? index}>{item.image ? <div data-tina-field={tinaField(item, 'image')} style={{ position: 'absolute', inset: 0 }}><LightboxImage className="portfolio-image" src={normalizeImageSrc(item.image) || item.image} alt={item.title ?? onSkinTitle} /></div> : <span>♡</span>}<small data-tina-field={item.image ? tinaField(item, 'title') : undefined}>{item.image ? item.title : c.onSkinPlaceholder}</small></div>)}</div><a className="text-link" href="/on-skin">{language === 'fi' ? 'Katso kaikki iholla' : 'View all on skin'} <ArrowUpRight size={15} /></a></section>
    <section className="section max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pricing-section"><Deco className="deco-flash">✦</Deco><Constellation area="flash-extra" /><div className="section-label">✦ 04 / {c.pricing}</div><p className="page-intro" data-tina-field={tinaField(site, priceIntroField)}>{priceIntro}</p><div className="flash-list">{pricingItems.slice(0, 3).map((row: any, index: number) => {
      const title = language === 'fi' ? row.titleFi || row.titleEn : row.titleEn || row.titleFi
      const description = language === 'fi' ? row.descriptionFi || row.descriptionEn : row.descriptionEn || row.descriptionFi
      return <div className="flash-row" key={`${row.price}-${title}-${index}`} data-tina-field={hasCmsPricing ? tinaField(row) : undefined}><strong data-tina-field={hasCmsPricing ? tinaField(row, 'price') : undefined}>{row.price}</strong><span><b data-tina-field={hasCmsPricing ? tinaField(row, pricingTitleField) : undefined}>{title}</b><small data-tina-field={hasCmsPricing ? tinaField(row, pricingDescriptionField) : undefined}>{description}</small></span><i>+</i></div>
    })}</div><a className="text-link" href="/flash">{language === 'fi' ? 'Katso kaikki flash-модели' : 'View all flash designs'} <ArrowUpRight size={16} /></a></section>
    <section className="section max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 contact-section"><Deco className="deco-contact">♡</Deco><Constellation area="contact-extra" /><div className="section-label">♡ 05 / {c.contact}</div><h2 data-tina-field={tinaField(site, contactTextField)}>{contactText}</h2><div className="contact-actions"><a className="primary-button" href="/booking">{c.book} <ArrowUpRight size={16} /></a><a className="instagram-link" href={instagram} target="_blank" rel="noreferrer"><span aria-hidden="true">♡</span> Instagram · @kisu.tatts</a></div></section>
  </main>
}
